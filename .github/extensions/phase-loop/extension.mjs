import { access, readdir, readFile, writeFile, unlink } from "node:fs/promises"
import path from "node:path"
import { exec as execCb } from "node:child_process"
import { promisify } from "node:util"
import { tmpdir } from "node:os"

import { joinSession } from "@github/copilot-sdk/extension"

const DEFAULT_GENERATOR_MODEL = "claude-opus-4.6-1m"
const DEFAULT_EVALUATOR_MODEL = "gpt-5.3-codex"
const DEFAULT_MAX_ITERATIONS = 10
const DEFAULT_TARGET_SCORE = 91
const SEND_TIMEOUT_MS = 60 * 60 * 1000
const LARGE_RUN_CONFIRMATION_THRESHOLD = 20

const GENERATOR_AGENT_NAME = "phase-loop-generator"
const EVALUATOR_AGENT_NAME = "phase-loop-evaluator"
const BLOCKING_PRIORITIES = new Set(["critical", "high", "medium"])
const ALL_STAGE_VALUES = new Set(["*", "all", "phase", "all-stages", "all stages", "allstages"])
const ALL_PHASE_VALUES = new Set(["*", "all", "all-phases", "all phases", "allphases"])
const EVALUATOR_BLOCKED_TOOLS = new Set(["apply_patch", "create", "edit", "write_file"])
const MUTATING_SHELL_PATTERN = /(^|\s)(git\s+(add|apply|am|commit|checkout|switch|merge|rebase|cherry-pick|reset|clean)|rm\s+-rf|del\s+\/|Remove-Item\b|Set-Content\b|Add-Content\b|Out-File\b|New-Item\b|Copy-Item\b|Move-Item\b|mv\b|cp\b|echo\s+.+>|>>)/i
const BRANCH_ESCAPE_SHELL_PATTERN = /(^|\s)(git\s+(worktree|checkout|switch|clone)\b)/i

class CancellationError extends Error {
    constructor() {
        super("phase-loop cancelled")
        this.name = "CancellationError"
    }
}

function throwIfStopped(run) {
    if (run.stopRequested) throw new CancellationError()
}

const sessionCwds = new Map()
const activeRuns = new Map()
const execAsync = promisify(execCb)
const PR_TIMEOUT_MS = 120_000

const GENERATOR_AGENT_PROMPT = [
    "You are the phase-loop generator agent.",
    "Your job is to implement a scoped requirement from an attached plan/spec file.",
    "Read the attached spec carefully, focus only on the requested phase/stage/step, and then make the repository changes needed to fully satisfy that scope.",
    "Fill gaps, fix tightly related bugs, add or update tests, and run the repository's existing build or test commands as needed to prove the scoped work.",
    "Prefer completing the work over describing what should be done. If the requirement is already satisfied, verify it and avoid churn.",
    "Use relevant project skills when they genuinely help.",
    "If you are told you are already on a prepared feature branch, you MUST stay on that branch: do NOT use git worktrees, do NOT create or switch branches, and commit your changes on the current branch before finishing.",
    "Only invoke the using-git-worktrees skill when no feature branch has been prepared for you and isolated feature work is needed.",
    "Keep going until the scoped implementation is complete or you hit a real blocker. If blocked, explain the blocker plainly.",
].join("\n")

const EVALUATOR_AGENT_PROMPT = [
    "You are the phase-loop evaluator agent.",
    "Critically and thoroughly review the latest repository state against the attached plan/spec file for the requested phase/stage/step.",
    "Be skeptical. Inspect code, docs, and relevant tests, and run the repository's existing build or test commands when that materially improves confidence.",
    "Do not modify files or try to implement fixes. Your job is evaluation only.",
    "If the todo-code-reviewer skill is available and applicable, invoke it before finalizing your evaluation.",
    "Return only machine-parseable JSON that matches the schema requested by the user prompt.",
    "Never give a score of 90 or above if any medium, high, or critical gap remains.",
].join("\n")

const session = await joinSession({
    commands: [
        {
            name: "phase-loop",
            description: "Run a generator/evaluator loop for all phases, a single phase, stage, or step.",
            handler: async (context) => {
                await startPhaseLoop(context)
            },
        },
        {
            name: "phase-loop-status",
            description: "Show the current phase-loop run status for this session.",
            handler: async (context) => {
                await showPhaseLoopStatus(context)
            },
        },
        {
            name: "phase-loop-stop",
            description: "Request that the active phase-loop run stop after the current pass finishes.",
            handler: async (context) => {
                await stopPhaseLoop(context)
            },
        },
    ],
    customAgents: [
        {
            name: GENERATOR_AGENT_NAME,
            displayName: "Phase Loop Generator",
            description: "Implements a scoped plan section end-to-end.",
            prompt: GENERATOR_AGENT_PROMPT,
        },
        {
            name: EVALUATOR_AGENT_NAME,
            displayName: "Phase Loop Evaluator",
            description: "Critically reviews a scoped plan section and reports JSON gaps.",
            prompt: EVALUATOR_AGENT_PROMPT,
        },
    ],
    hooks: {
        onSessionStart: async (input, invocation) => {
            if (input.cwd)
                sessionCwds.set(invocation.sessionId, input.cwd)

            await session.log(
                "phase-loop loaded. Use /phase-loop to run all phases, or /phase-loop phase=N to run a specific phase.",
                { ephemeral: true }
            )
        },
        onSessionEnd: async (_input, invocation) => {
            const run = activeRuns.get(invocation.sessionId)
            if (run) {
                run.stopRequested = true
                for (const waiter of run.cancelWaiters) waiter()
                run.cancelWaiters.clear()
            }

            activeRuns.delete(invocation.sessionId)
            sessionCwds.delete(invocation.sessionId)
        },
        onUserPromptSubmitted: async (input, invocation) => {
            if (input.cwd)
                sessionCwds.set(invocation.sessionId, input.cwd)
        },
        onPreToolUse: async (input, invocation) => {
            const run = activeRuns.get(invocation.sessionId)
            if (!run)
                return

            // --- Generator guards: prevent branch escape when a feature branch is prepared ---
            if (run.role === "generator" && run.branchContext) {
                // Block the using-git-worktrees skill
                if (input.toolName === "skill") {
                    const skillArg = String(input.toolArgs?.skill || input.toolArgs?.name || "").toLowerCase()
                    if (skillArg.includes("worktree")) {
                        return {
                            permissionDecision: "deny",
                            permissionDecisionReason: `phase-loop generator is on prepared feature branch '${run.branchContext.branchName}'. Worktrees are not allowed — work directly on the current branch.`,
                        }
                    }
                }

                // Block shell commands that would escape the branch
                if ((input.toolName === "bash" || input.toolName === "powershell")
                    && BRANCH_ESCAPE_SHELL_PATTERN.test(String(input.toolArgs?.command || ""))) {
                    return {
                        permissionDecision: "deny",
                        permissionDecisionReason: `phase-loop generator is on prepared feature branch '${run.branchContext.branchName}'. Do not use git worktree, checkout, switch, or clone — work directly on the current branch.`,
                    }
                }
            }

            // --- Evaluator guards: read-only enforcement ---
            if (run.role !== "evaluator")
                return

            if (EVALUATOR_BLOCKED_TOOLS.has(input.toolName)) {
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason: "phase-loop evaluator runs are review-only and must not edit files.",
                }
            }

            if ((input.toolName === "bash" || input.toolName === "powershell")
                && MUTATING_SHELL_PATTERN.test(String(input.toolArgs?.command || ""))) {
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason: "phase-loop evaluator runs are review-only and must not use mutating shell commands.",
                }
            }
        },
    },
})

async function startPhaseLoop(context) {
    const existing = activeRuns.get(context.sessionId)
    if (existing?.active || existing?.draining) {
        await session.log(
            `phase-loop is ${existing.draining ? "draining a cancelled pass" : "running"} for ${formatRunScope(existing.config)}. Use /phase-loop-status or /phase-loop-stop.`,
            { level: "warning" }
        )
        return
    }

    let config
    try {
        config = await resolveRunConfig(context)
    } catch (error) {
        await session.log(`phase-loop could not start: ${error.message}`, { level: "error" })
        return
    }

    if (!config)
        return

    const run = {
        active: true,
        stopRequested: false,
        draining: false,
        role: null,
        branchContext: null,
        iteration: 0,
        lastEvaluation: null,
        currentTarget: null,
        currentTargetIndex: -1,
        completedTargets: [],
        config,
        originalModel: null,
        originalAgent: null,
        cancelWaiters: new Set(),
        inFlightPromise: null,
    }

    activeRuns.set(context.sessionId, run)

    await session.log(
        [
            `Starting phase-loop for ${formatRunScope(config)}.`,
            `Targets: ${config.targets.length}.`,
            `Generator model: ${config.generatorModel}.`,
            `Evaluator model: ${config.evaluatorModel}.`,
            `Max iterations: ${config.maxIterations}.`,
            `Passing score: ${config.targetScore} or higher with no medium-or-higher gaps.`,
            `Auto PR: ${config.createPR ? "enabled (create & merge PR per step)" : "disabled"}.`,
            "Avoid unrelated prompts in this session until the loop finishes.",
        ].join(" "),
        { level: "info" }
    )

    setTimeout(() => {
        runPhaseLoop(context.sessionId, run).catch(async (error) => {
            await session.log(`phase-loop failed: ${error.message}`, { level: "error" })
        })
    }, 0)
}

async function showPhaseLoopStatus(context) {
    const run = activeRuns.get(context.sessionId)
    if (!run?.active && !run?.draining) {
        await session.log("No phase-loop run is active for this session.", { level: "warning" })
        return
    }

    const score = run.lastEvaluation ? `${run.lastEvaluation.score}%` : "n/a"
    const currentScope = run.currentTarget ? formatScope(run.currentTarget) : "starting"
    const state = run.draining ? "draining cancelled pass" : run.stopRequested ? "stop requested" : "running"
    await session.log(
        [
            `phase-loop is ${state} for ${formatRunScope(run.config)}.`,
            `Completed targets: ${run.completedTargets.length}/${run.config.targets.length}.`,
            `Current scope: ${currentScope}.`,
            `Iteration: ${run.iteration || 0}/${run.config.maxIterations}.`,
            `Current pass: ${run.role || "starting"}.`,
            `Last score: ${score}.`,
        ].join(" "),
        { level: "info" }
    )
}

async function stopPhaseLoop(context) {
    const run = activeRuns.get(context.sessionId)
    if (!run?.active && !run?.draining) {
        await session.log("No phase-loop run is active for this session.", { level: "warning" })
        return
    }

    if (run.draining) {
        await session.log("phase-loop is already draining after a previous stop request.", { level: "warning" })
        return
    }

    run.stopRequested = true
    for (const waiter of run.cancelWaiters) waiter()
    run.cancelWaiters.clear()

    await session.log(
        "phase-loop stop requested. The loop will stop shortly; the in-flight pass will drain in the background.",
        { level: "warning" }
    )
}

async function runPhaseLoop(sessionId, run) {
    try {
        const currentModel = await session.rpc.model.getCurrent()
        const currentAgent = await session.rpc.agent.getCurrent()
        run.originalModel = currentModel.modelId ?? null
        run.originalAgent = currentAgent.agent?.name ?? null

        let haltedEarly = false
        for (let targetIndex = 0; targetIndex < run.config.targets.length; targetIndex += 1) {
            if (run.stopRequested) {
                haltedEarly = true
                break
            }

            const target = run.config.targets[targetIndex]
            const completed = await runTargetLoop(sessionId, run, target, targetIndex)
            if (!completed) {
                haltedEarly = true
                break
            }
        }

        if (run.stopRequested) {
            const stopScope = run.currentTarget ? formatScope(run.currentTarget) : formatRunScope(run.config)
            await session.log(
                `phase-loop stopped for ${formatRunScope(run.config)} during ${stopScope} after iteration ${run.iteration}.`,
                { level: "warning" }
            )
            return
        }

        if (haltedEarly) {
            const lastScore = run.lastEvaluation ? `${run.lastEvaluation.score}%` : "n/a"
            await session.log(
                `phase-loop ended without meeting the completion target for ${formatScope(run.currentTarget)} after ${run.config.maxIterations} iteration(s). Last score: ${lastScore}.`,
                { level: "warning" }
            )
            return
        }

        await session.log(
            `phase-loop complete for ${formatRunScope(run.config)}. ${formatCompletedTargetSummary(run.completedTargets)}`,
            { level: "info" }
        )
    } catch (error) {
        if (error instanceof CancellationError) {
            const stopScope = run.currentTarget ? formatScope(run.currentTarget) : formatRunScope(run.config)
            await session.log(
                `phase-loop stopped for ${formatRunScope(run.config)} during ${stopScope} after iteration ${run.iteration}.`,
                { level: "warning" }
            )

            // Drain the in-flight sendAndWait so guards remain active while the agent finishes
            const inflight = run.inFlightPromise
            if (inflight) {
                run.draining = true
                await session.log("Draining in-flight pass (guards remain active)...", { level: "info" })
                try { await inflight } catch { /* swallow — the pass result is discarded */ }
                await session.log("In-flight pass drained.", { level: "info" })
            }

            // Now safe to clean up branch context that was preserved during cancellation
            if (run.branchContext) {
                const prCwd = sessionCwds.get(sessionId) || process.cwd()
                try {
                    await returnToBaseBranch(prCwd, run.branchContext)
                } catch { /* best effort */ }
                run.branchContext = null
            }
            return
        }
        throw error
    } finally {
        run.active = false
        run.draining = false
        run.role = null
        activeRuns.delete(sessionId)
        await restoreSessionState(run)
    }
}

async function runTargetLoop(sessionId, run, target, targetIndex) {
    run.currentTarget = target
    run.currentTargetIndex = targetIndex
    run.iteration = 0
    run.lastEvaluation = null

    await session.log(
        `phase-loop target ${targetIndex + 1}/${run.config.targets.length}: ${formatScope(target)}.`,
        { level: "info" }
    )

    // Prepare feature branch if PR workflow is enabled
    throwIfStopped(run)
    const prCwd = sessionCwds.get(sessionId) || process.cwd()
    const branchContext = run.config.createPR
        ? await prepareFeatureBranch(prCwd, target)
        : null

    // Store on run so onPreToolUse hook can enforce branch guards
    run.branchContext = branchContext

    let stepPassed = false

    try {
        for (let iteration = 1; iteration <= run.config.maxIterations; iteration += 1) {
            throwIfStopped(run)

            run.iteration = iteration
            run.role = "generator"

            await switchModelAndAgent(run.config.generatorModel, GENERATOR_AGENT_NAME)
            await session.log(
                `phase-loop target ${targetIndex + 1}/${run.config.targets.length}, iteration ${iteration}: generator pass for ${formatScope(target)}.`,
                { level: "info" }
            )

            await sendAndWaitCancellable(
                run,
                {
                    prompt: buildGeneratorPrompt(target, run.lastEvaluation, iteration, run.config, targetIndex, branchContext),
                    attachments: buildAttachments(target),
                },
                SEND_TIMEOUT_MS
            )

            throwIfStopped(run)

            run.role = "evaluator"

            await switchModelAndAgent(run.config.evaluatorModel, EVALUATOR_AGENT_NAME)
            await session.log(
                `phase-loop target ${targetIndex + 1}/${run.config.targets.length}, iteration ${iteration}: evaluator pass for ${formatScope(target)}.`,
                { level: "info" }
            )

            run.lastEvaluation = await requestEvaluation(run, target, targetIndex)

            const blockingGaps = run.lastEvaluation.gaps.filter((gap) => BLOCKING_PRIORITIES.has(gap.priority))
            const logLevel = blockingGaps.length > 0 || run.lastEvaluation.score < run.config.targetScore ? "warning" : "info"
            const gapSummary = formatGapSummary(run.lastEvaluation.gaps)

            await session.log(
                [
                    `phase-loop target ${targetIndex + 1}/${run.config.targets.length}, iteration ${iteration} evaluation: score ${run.lastEvaluation.score}%.`,
                    `Blocking gaps: ${blockingGaps.length}.`,
                    `Summary: ${run.lastEvaluation.summary}.`,
                    gapSummary ? `Top gaps: ${gapSummary}.` : "No remaining gaps reported.",
                ].join(" "),
                { level: logLevel }
            )

            if (shouldStop(run.lastEvaluation, run.config.targetScore)) {
                run.completedTargets.push({
                    target,
                    evaluation: run.lastEvaluation,
                    iterations: iteration,
                })

                // Create PR and merge to base branch BEFORE marking step complete
                throwIfStopped(run)
                let prStatus = "merged"
                if (branchContext) {
                    prStatus = await createAndMergePR(prCwd, branchContext, target, run.lastEvaluation)
                }

                // Only mark step as [x] if PR workflow succeeded (or PR is disabled)
                const prSucceeded = !branchContext || prStatus === "merged" || prStatus === "pushed_only"
                if (prSucceeded) {
                    stepPassed = true
                    if (target.step) {
                        const specPath = target.stagePlanPath || target.phasePlanPath
                        const markerUpdated = await updateStepMarkerInFile(specPath, Number(target.step), "x")
                        if (markerUpdated) {
                            await session.log(
                                `phase-loop marked step ${target.step} as [x] (complete) in ${specPath}.`,
                                { level: "info" }
                            )
                        }
                    }
                    await session.log(
                        `phase-loop complete for ${formatScope(target)} with score ${run.lastEvaluation.score}% and no medium-or-higher gaps.`,
                        { level: "info" }
                    )
                } else {
                    // PR workflow failed — mark step as in-progress so it gets retried
                    if (target.step) {
                        const specPath = target.stagePlanPath || target.phasePlanPath
                        const markerUpdated = await updateStepMarkerInFile(specPath, Number(target.step), "~")
                        if (markerUpdated) {
                            await session.log(
                                `phase-loop marked step ${target.step} as [~] (in-progress) — evaluation passed but PR workflow failed.`,
                                { level: "warning" }
                            )
                        }
                    }
                    await session.log(
                        `phase-loop evaluation passed for ${formatScope(target)} (score ${run.lastEvaluation.score}%) but PR workflow failed. Step NOT marked complete.`,
                        { level: "warning" }
                    )
                }
                return prSucceeded
            }
        }

        // Max iterations exhausted without meeting target — mark step as in-progress
        if (!run.stopRequested && target.step && run.iteration > 0) {
            const specPath = target.stagePlanPath || target.phasePlanPath
            const markerUpdated = await updateStepMarkerInFile(specPath, Number(target.step), "~")
            if (markerUpdated) {
                await session.log(
                    `phase-loop marked step ${target.step} as [~] (in-progress) in ${specPath}.`,
                    { level: "info" }
                )
            }
        }

        return false
    } finally {
        // On cancellation, keep branch context and guards alive for draining
        if (run.stopRequested) return

        // Normal cleanup: clear branch context and return to base
        run.branchContext = null
        if (!stepPassed && branchContext) {
            try {
                await returnToBaseBranch(prCwd, branchContext)
            } catch { /* best effort */ }
        }
    }
}

async function requestEvaluation(run, target, targetIndex) {
    const firstResponse = await sendAndWaitCancellable(
        run,
        {
            prompt: buildEvaluatorPrompt(target, run.iteration, run.config, targetIndex),
            attachments: buildAttachments(target),
        },
        SEND_TIMEOUT_MS
    )

    try {
        return parseEvaluation(firstResponse?.data?.content || "")
    } catch (_error) {
        if (_error instanceof CancellationError) throw _error

        const retryResponse = await sendAndWaitCancellable(
            run,
            {
                prompt: [
                    "Your previous response was not valid JSON.",
                    "Return only JSON with this exact shape:",
                    "{\"score\": number, \"summary\": string, \"gaps\": [{\"priority\": \"critical|high|medium|low\", \"title\": string, \"details\": string, \"recommendation\": string}]}",
                ].join("\n"),
            },
            SEND_TIMEOUT_MS
        )

        return parseEvaluation(retryResponse?.data?.content || "")
    }
}

async function restoreSessionState(run) {
    try {
        if (run.originalModel)
            await session.rpc.model.switchTo({ modelId: run.originalModel })
    } catch (error) {
        await session.log(`phase-loop could not restore the previous model: ${error.message}`, { level: "warning" })
    }

    try {
        if (run.originalAgent)
            await session.rpc.agent.select({ name: run.originalAgent })
        else
            await session.rpc.agent.deselect()
    } catch (error) {
        await session.log(`phase-loop could not restore the previous agent: ${error.message}`, { level: "warning" })
    }
}

async function switchModelAndAgent(modelId, agentName) {
    await session.rpc.model.switchTo({ modelId })
    await session.rpc.agent.select({ name: agentName })
}

async function sendAndWaitCancellable(run, message, timeout) {
    throwIfStopped(run)

    const sendPromise = session.sendAndWait(message, timeout)
    run.inFlightPromise = sendPromise

    // Clear inFlightPromise when the underlying call settles (regardless of race outcome)
    sendPromise.then(
        () => { if (run.inFlightPromise === sendPromise) run.inFlightPromise = null },
        () => { if (run.inFlightPromise === sendPromise) run.inFlightPromise = null }
    )

    let waiter
    const cancelPromise = new Promise((_, reject) => {
        waiter = () => reject(new CancellationError())
        run.cancelWaiters.add(waiter)
    })

    try {
        return await Promise.race([sendPromise, cancelPromise])
    } finally {
        if (waiter) run.cancelWaiters.delete(waiter)
    }
}

async function resolveRunConfig(context) {
    const parsed = parseCommandArgs(context.args)
    if (parsed.invalidTokens.length > 0 && !session.capabilities.ui?.elicitation) {
        throw new Error(
            `Unrecognized arguments: ${parsed.invalidTokens.join(", ")}. ${getUsage()}`
        )
    }

    const cwd = sessionCwds.get(context.sessionId) || process.cwd()
    const repoRoot = await findRepoRoot(cwd)
    const isAllPhases = isAllPhasesValue(parsed.phase)
    const defaultPlanPath = isAllPhases ? "" : await getDefaultPlanPath(cwd, parsed.phase)

    let values = {
        planPath: parsed.planPath || defaultPlanPath || "",
        phase: isAllPhases ? "" : normalizePhaseValue(parsed.phase),
        stage: normalizeStageValue(parsed.stage),
        step: String(parsed.step || "").trim(),
        includeChecked: parsed.includeChecked ?? false,
        createPR: parsed.createPR ?? true,
        generatorModel: parsed.generatorModel || DEFAULT_GENERATOR_MODEL,
        evaluatorModel: parsed.evaluatorModel || DEFAULT_EVALUATOR_MODEL,
        maxIterations: parsed.maxIterations || DEFAULT_MAX_ITERATIONS,
        targetScore: normalizeTargetScore(parsed.targetScore),
        allPhases: isAllPhases || (!parsed.phase && !parsed.planPath),
    }

    const needsElicitation = parsed.invalidTokens.length > 0
        || (!values.allPhases && !values.planPath)
        || (!values.allPhases && !values.phase)
    let userConfirmedViaElicitation = false

    if (needsElicitation) {
        if (!session.capabilities.ui?.elicitation) {
            if (values.allPhases)
                {} // No elicitation needed for all-phases
            else
                throw new Error(getUsage())
        } else {
            const result = await session.ui.elicitation({
                message: [
                    "Provide the phase-loop scope.",
                    "Leave phase blank (or set to 'all') to run every phase found under docs/phases/.",
                    "Leave stage blank (or set to 'all') to run every discovered stage in the phase.",
                    "Steps within each stage are discovered automatically.",
                ].join(" "),
                requestedSchema: {
                    type: "object",
                    properties: {
                        planPath: {
                            type: "string",
                            title: "Plan or spec path",
                            description: "Absolute or repo-relative path to the plan/spec markdown file. Leave blank for auto-discovery from docs/phases/.",
                            default: values.planPath,
                        },
                        phase: {
                            type: "string",
                            title: "Phase",
                            description: "Phase identifier (e.g. '3') or 'all' for every phase. Leave blank for all phases.",
                            default: values.phase,
                        },
                        stage: {
                            type: "string",
                            title: "Stage",
                            description: "Optional. Stage identifier within the phase. Leave blank or use 'all' to run every discovered stage.",
                            default: values.stage,
                        },
                        step: {
                            type: "string",
                            title: "Step",
                            description: "Optional step identifier within the stage. Only valid when stage is set.",
                            default: values.step,
                        },
                        includeChecked: {
                            type: "boolean",
                            title: "Include completed steps",
                            description: "If true, also run steps already marked [x] in the spec. Default is false (skip completed steps).",
                            default: values.includeChecked,
                        },
                        createPR: {
                            type: "boolean",
                            title: "Create & merge PR per step",
                            description: "If true, create a feature branch, PR, and merge to main after each passing step. Default is true.",
                            default: values.createPR,
                        },
                        targetScore: {
                            type: "integer",
                            title: "Passing score",
                            description: "Minimum evaluator score required for a step/stage to pass.",
                            minimum: 1,
                            maximum: 100,
                            default: values.targetScore,
                        },
                        generatorModel: {
                            type: "string",
                            title: "Generator model",
                            description: "Model ID for the implementation generator.",
                            default: values.generatorModel,
                        },
                        evaluatorModel: {
                            type: "string",
                            title: "Evaluator model",
                            description: "Model ID for the evaluator.",
                            default: values.evaluatorModel,
                        },
                        maxIterations: {
                            type: "integer",
                            title: "Max iterations",
                            description: "Safety cap for generator/evaluator loop iterations per step/stage.",
                            minimum: 1,
                            default: values.maxIterations,
                        },
                    },
                    required: ["targetScore", "generatorModel", "evaluatorModel", "maxIterations"],
                },
            })

            if (result.action !== "accept") {
                await session.log("phase-loop start cancelled.", { level: "warning" })
                return null
            }

            userConfirmedViaElicitation = true
            const elicitedPhase = String(result.content?.phase || "").trim()
            const elicitedAllPhases = !elicitedPhase || isAllPhasesValue(elicitedPhase)

            values = {
                planPath: String(result.content?.planPath || "").trim(),
                phase: elicitedAllPhases ? "" : normalizePhaseValue(elicitedPhase),
                stage: normalizeStageValue(result.content?.stage),
                step: String(result.content?.step || "").trim(),
                includeChecked: result.content?.includeChecked ?? false,
                createPR: result.content?.createPR ?? true,
                targetScore: normalizeTargetScore(result.content?.targetScore),
                generatorModel: String(result.content?.generatorModel || DEFAULT_GENERATOR_MODEL).trim(),
                evaluatorModel: String(result.content?.evaluatorModel || DEFAULT_EVALUATOR_MODEL).trim(),
                maxIterations: normalizeIterationCount(result.content?.maxIterations),
                allPhases: elicitedAllPhases,
            }
        }
    }

    // Validate invalid argument combinations
    if (values.step && !values.stage)
        throw new Error("A step can only be used when stage is set.")

    if (values.allPhases && values.stage)
        throw new Error("Cannot specify a stage when running all phases. Set a specific phase first.")

    if (values.allPhases && values.step)
        throw new Error("Cannot specify a step when running all phases.")

    // Resolve targets based on scope
    let targets
    let scopeMode

    if (values.allPhases) {
        if (!repoRoot)
            throw new Error("Could not find a git repository root to discover phase plans.")

        const phaseEntries = await discoverAllPhases(repoRoot)
        if (phaseEntries.length === 0)
            throw new Error("No phase plan files found under docs/phases/.")

        targets = []
        for (const phaseEntry of phaseEntries) {
            const phaseTargets = await resolveRunTargets({
                phasePlanPath: phaseEntry.path,
                phase: phaseEntry.phase,
                stage: "",
                step: "",
                includeChecked: values.includeChecked,
            })
            targets.push(...phaseTargets)
        }

        scopeMode = "all-phases"
    } else {
        if (!values.phase)
            throw new Error(getUsage())

        let resolvedPlanPath
        if (values.planPath) {
            resolvedPlanPath = path.isAbsolute(values.planPath)
                ? values.planPath
                : path.resolve(cwd, values.planPath)
        } else {
            const defaultPath = await getDefaultPlanPath(cwd, values.phase)
            if (!defaultPath)
                throw new Error(`Could not find a plan file for phase ${values.phase}. Provide plan=<path>.`)
            resolvedPlanPath = path.isAbsolute(defaultPath)
                ? defaultPath
                : path.resolve(cwd, defaultPath)
        }

        await assertFileExists(resolvedPlanPath)
        targets = await resolveRunTargets({
            phasePlanPath: resolvedPlanPath,
            phase: values.phase,
            stage: values.stage,
            step: values.step,
            includeChecked: values.includeChecked,
        })

        scopeMode = values.step ? "single-step" : values.stage ? "single-stage" : "phase"
        values.planPath = resolvedPlanPath
    }

    if (targets.length === 0)
        throw new Error("No actionable targets found. All steps may already be completed. Use includeChecked=true to re-run them.")

    // Safety confirmation for large runs (skip if user already confirmed via elicitation)
    if (!userConfirmedViaElicitation && targets.length >= LARGE_RUN_CONFIRMATION_THRESHOLD && session.capabilities.ui?.elicitation) {
        const confirmation = await session.ui.elicitation({
            message: `This will run ${targets.length} target(s) with up to ${values.maxIterations} iterations each (max ${targets.length * values.maxIterations} generator+evaluator passes). Continue?`,
            requestedSchema: {
                type: "object",
                properties: {
                    confirm: {
                        type: "boolean",
                        title: "Confirm large run",
                        description: `${targets.length} targets detected. This could take a very long time.`,
                        default: false,
                    },
                },
                required: ["confirm"],
            },
        })

        if (confirmation.action !== "accept" || !confirmation.content?.confirm) {
            await session.log("phase-loop start cancelled due to large run size.", { level: "warning" })
            return null
        }
    }

    return {
        planPath: values.planPath || null,
        phase: values.phase || "all",
        stage: values.stage || null,
        step: values.step || null,
        includeChecked: values.includeChecked,
        createPR: values.createPR,
        generatorModel: values.generatorModel,
        evaluatorModel: values.evaluatorModel,
        maxIterations: normalizeIterationCount(values.maxIterations),
        targetScore: normalizeTargetScore(values.targetScore),
        scopeMode,
        targets,
    }
}

async function getDefaultPlanPath(cwd, phase) {
    const phasePlan = await getDefaultPhasePlanPath(cwd, phase)
    if (phasePlan)
        return phasePlan

    const workspacePlan = session.workspacePath
        ? path.join(session.workspacePath, "plan.md")
        : null

    if (workspacePlan && await fileExists(workspacePlan))
        return workspacePlan

    const repoPlan = path.join(cwd, "plan.md")
    if (await fileExists(repoPlan))
        return repoPlan

    return ""
}

function buildGeneratorPrompt(target, lastEvaluation, iteration, runConfig, targetIndex, branchContext) {
    const scope = formatScope(target)
    const evaluatorContext = lastEvaluation
        ? [
            "The latest evaluator findings are below. Treat every listed gap as required follow-up work for this iteration.",
            JSON.stringify(lastEvaluation, null, 2),
        ].join("\n")
        : "There is no prior evaluator feedback yet. Implement the scoped spec from scratch."

    const stepContext = target.stepText
        ? [
            "The specific step specification is quoted below. Focus your implementation on this step only:",
            "---",
            target.stepText,
            "---",
        ].join("\n")
        : ""

    const branchInstructions = branchContext
        ? [
            `CRITICAL — BRANCH RULES: You are on prepared feature branch '${branchContext.branchName}' (base: '${branchContext.baseBranch}').`,
            "• Do NOT use git worktrees, git checkout, git switch, git clone, or the using-git-worktrees skill.",
            "• Make ALL changes directly in the current working directory on this branch.",
            "• Commit your changes with descriptive messages (git add -A && git commit -m '...') before finishing your pass.",
            "• The branch will be pushed and merged automatically after evaluation passes.",
        ].join("\n")
        : ""

    return [
        `Work on ${scope}.`,
        branchInstructions,
        runConfig.scopeMode === "all-phases"
            ? `This is target ${targetIndex + 1} of ${runConfig.targets.length} across all phases. Finish this target before moving on.`
            : runConfig.scopeMode === "phase"
                ? `This is stage target ${targetIndex + 1} of ${runConfig.targets.length} for phase ${runConfig.phase}. Finish this stage before moving on to later stages.`
                : `This is target ${targetIndex + 1} of ${runConfig.targets.length}.`,
        buildSourceOfTruthText(target),
        stepContext,
        target.step
            ? "Implement ONLY the requested step completely in repository code and tests. Do not implement other steps."
            : "Implement the requested scope completely in repository code and tests.",
        "Fill gaps, fix tightly related bugs, add or update tests, run the existing repository build/test commands, and sync any directly related progress artifacts when appropriate.",
        "Do not stop at analysis if implementation can continue.",
        `This target passes only when the evaluator score is ${runConfig.targetScore} or higher and no medium, high, or critical gaps remain.`,
        `This is generator iteration ${iteration}.`,
        evaluatorContext,
        "When you finish this pass, give a concise implementation summary and note any real blockers or residual uncertainty.",
    ].filter(Boolean).join("\n\n")
}

function buildEvaluatorPrompt(target, iteration, runConfig, targetIndex) {
    const stepContext = target.stepText
        ? [
            "The specific step specification is quoted below. Evaluate ONLY this step (plus any regressions it causes):",
            "---",
            target.stepText,
            "---",
        ].join("\n")
        : ""

    return [
        `Evaluate ${formatScope(target)} against the attached spec file(s).`,
        runConfig.scopeMode === "all-phases"
            ? `This is target ${targetIndex + 1} of ${runConfig.targets.length} across all phases.`
            : runConfig.scopeMode === "phase"
                ? `This is stage target ${targetIndex + 1} of ${runConfig.targets.length} for phase ${runConfig.phase}.`
                : `This is target ${targetIndex + 1} of ${runConfig.targets.length}.`,
        buildSourceOfTruthText(target),
        stepContext,
        `This is evaluator iteration ${iteration}.`,
        target.step
            ? "Inspect the current implementation critically and thoroughly for THIS STEP ONLY. Do not flag missing implementation for other steps as gaps."
            : "Inspect the current implementation critically and thoroughly. Read code, docs, and relevant tests, and run existing build/test commands if they materially improve confidence.",
        "Return only JSON with this exact shape:",
        "{\"score\": number, \"summary\": string, \"gaps\": [{\"priority\": \"critical|high|medium|low\", \"title\": string, \"details\": string, \"recommendation\": string}]}",
        "Rules:",
        "1. Score is 0-100.",
        "2. Score 90 or above is only allowed when no medium, high, or critical gaps remain.",
        "3. Every real gap must appear in the gaps array with a concrete recommendation.",
        "4. If there are no remaining gaps, return an empty array.",
    ].filter(Boolean).join("\n")
}

function parseCommandArgs(argString) {
    const tokens = tokenize(argString)
    const parsed = {
        planPath: null,
        phase: null,
        stage: null,
        step: null,
        includeChecked: null,
        createPR: null,
        generatorModel: null,
        evaluatorModel: null,
        maxIterations: null,
        targetScore: null,
        invalidTokens: [],
    }

    for (const token of tokens) {
        const separatorIndex = token.indexOf("=")
        if (separatorIndex <= 0) {
            parsed.invalidTokens.push(token)
            continue
        }

        const rawKey = token.slice(0, separatorIndex).trim().toLowerCase()
        const value = token.slice(separatorIndex + 1).trim()
        const key = normalizeArgKey(rawKey)

        if (!key) {
            parsed.invalidTokens.push(token)
            continue
        }

        if (key === "maxIterations")
            parsed.maxIterations = normalizeIterationCount(value)
        else if (key === "includeChecked")
            parsed.includeChecked = value === "true" || value === "1" || value === "yes"
        else if (key === "createPR")
            parsed.createPR = value === "true" || value === "1" || value === "yes"
        else
            parsed[key] = value
    }

    return parsed
}

function normalizeArgKey(key) {
    switch (key) {
        case "plan":
        case "planpath":
        case "spec":
        case "specpath":
            return "planPath"
        case "phase":
            return "phase"
        case "stage":
            return "stage"
        case "step":
            return "step"
        case "generatormodel":
        case "generator":
        case "genmodel":
            return "generatorModel"
        case "evaluatormodel":
        case "evaluator":
        case "reviewmodel":
            return "evaluatorModel"
        case "maxiterations":
        case "iterations":
        case "max":
            return "maxIterations"
        case "targetscore":
        case "passingscore":
        case "threshold":
        case "minscore":
        case "scoretarget":
            return "targetScore"
        case "includechecked":
        case "checked":
        case "includecompleted":
        case "completed":
        case "rerun":
            return "includeChecked"
        case "createpr":
        case "pr":
        case "autopr":
        case "mergepr":
            return "createPR"
        default:
            return null
    }
}

function tokenize(argString) {
    const matches = argString.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\S+/g) || []
    return matches.map(unquote)
}

function unquote(token) {
    if ((token.startsWith("\"") && token.endsWith("\"")) || (token.startsWith("'") && token.endsWith("'")))
        return token.slice(1, -1)

    return token
}

function normalizeIterationCount(value) {
    const numeric = Number.parseInt(String(value ?? DEFAULT_MAX_ITERATIONS), 10)
    if (!Number.isFinite(numeric) || numeric < 1)
        return DEFAULT_MAX_ITERATIONS

    return numeric
}

function normalizeTargetScore(value) {
    const numeric = Number.parseInt(String(value ?? DEFAULT_TARGET_SCORE), 10)
    if (!Number.isFinite(numeric) || numeric < 1)
        return DEFAULT_TARGET_SCORE

    return Math.max(1, Math.min(100, numeric))
}

function parseEvaluation(text) {
    const candidates = []
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fencedMatch)
        candidates.push(fencedMatch[1])

    candidates.push(text)

    const firstBrace = text.indexOf("{")
    const lastBrace = text.lastIndexOf("}")
    if (firstBrace >= 0 && lastBrace > firstBrace)
        candidates.push(text.slice(firstBrace, lastBrace + 1))

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.trim())
            return normalizeEvaluation(parsed)
        } catch {
            // Try the next candidate.
        }
    }

    throw new Error("Evaluator did not return valid JSON.")
}

function normalizeEvaluation(parsed) {
    if (!parsed || typeof parsed !== "object")
        throw new Error("Evaluator JSON must be an object.")

    const score = Number(parsed.score)
    if (!Number.isFinite(score))
        throw new Error("Evaluator JSON must include a numeric score.")

    const rawGaps = Array.isArray(parsed.gaps) ? parsed.gaps : []
    const gaps = rawGaps.map((gap) => normalizeGap(gap))

    return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        summary: String(parsed.summary || "").trim(),
        gaps: sortGaps(gaps),
    }
}

function normalizeGap(gap) {
    const priority = String(gap?.priority || "").trim().toLowerCase()
    if (!["critical", "high", "medium", "low"].includes(priority))
        throw new Error("Evaluator gap priority must be critical, high, medium, or low.")

    return {
        priority,
        title: String(gap?.title || "").trim(),
        details: String(gap?.details || "").trim(),
        recommendation: String(gap?.recommendation || "").trim(),
    }
}

function sortGaps(gaps) {
    const priorityOrder = new Map([
        ["critical", 0],
        ["high", 1],
        ["medium", 2],
        ["low", 3],
    ])

    return [...gaps].sort((left, right) => {
        const leftRank = priorityOrder.get(left.priority) ?? 99
        const rightRank = priorityOrder.get(right.priority) ?? 99
        return leftRank - rightRank
    })
}

function shouldStop(evaluation, targetScore) {
    return evaluation.score >= targetScore
        && evaluation.gaps.every((gap) => !BLOCKING_PRIORITIES.has(gap.priority))
}

function formatGapSummary(gaps) {
    return gaps
        .slice(0, 3)
        .map((gap) => `[${gap.priority}] ${gap.title || gap.recommendation || "Untitled gap"}`)
        .join("; ")
}

function formatScope(config) {
    const parts = [`phase ${config.phase}`]
    if (config.stage)
        parts.push(`stage ${config.stage}`)
    if (config.step)
        parts.push(`step ${config.step}`)

    return parts.join(" -> ")
}

function formatRunScope(config) {
    if (config.scopeMode === "all-phases")
        return `all phases (${config.targets.length} targets)`

    if (config.scopeMode === "phase") {
        const hasStages = config.targets.some((t) => t.stage)
        return hasStages
            ? `phase ${config.phase} -> all stages (${config.targets.length} targets)`
            : `phase ${config.phase} (${config.targets.length} target${config.targets.length === 1 ? "" : "s"})`
    }

    return formatScope(config.targets[0] || config)
}

function formatCompletedTargetSummary(completedTargets) {
    if (completedTargets.length === 0)
        return "No targets completed."

    const summary = completedTargets
        .slice(0, 8)
        .map((entry) => {
            const label = entry.target.step
                ? `stage ${entry.target.stage} step ${entry.target.step}`
                : entry.target.stage
                    ? `stage ${entry.target.stage}`
                    : `phase ${entry.target.phase}`
            return `${label}: ${entry.evaluation.score}%`
        })
        .join("; ")

    const extra = completedTargets.length > 8
        ? ` (+${completedTargets.length - 8} more)`
        : ""

    return `Completed ${completedTargets.length} target(s). Scores: ${summary}.${extra}`
}

function getUsage() {
    return "Usage: /phase-loop [plan=<path>] [phase=<value>|phase=all] [stage=<value>|stage=all] [step=<value>] [includeChecked=true] [createPR=true|false] [targetScore=<n>] [generatorModel=<id>] [evaluatorModel=<id>] [maxIterations=<n>]. Omit phase to run all phases from docs/phases/."
}

async function assertFileExists(filePath) {
    if (!await fileExists(filePath))
        throw new Error(`Plan/spec file not found: ${filePath}`)
}

async function fileExists(filePath) {
    try {
        await access(filePath)
        return true
    } catch {
        return false
    }
}

async function getDefaultPhasePlanPath(cwd, phase) {
    const normalizedPhase = normalizePhaseValue(phase)
    const phaseNumber = getNormalizedNumber(normalizedPhase)
    if (phaseNumber == null)
        return ""

    const repoRoot = await findRepoRoot(cwd)
    if (!repoRoot)
        return ""

    const phasesDirectory = path.join(repoRoot, "docs", "phases")
    if (!await fileExists(phasesDirectory))
        return ""

    const entries = await readdir(phasesDirectory, { withFileTypes: true })
    const prefix = `phase_${String(phaseNumber).padStart(2, "0")}_`
    const matches = entries
        .filter((entry) => entry.isFile()
            && entry.name.toLowerCase().startsWith(prefix.toLowerCase())
            && entry.name.toLowerCase().endsWith(".md"))
        .map((entry) => path.join(phasesDirectory, entry.name))
        .sort((left, right) => left.localeCompare(right))

    return matches[0] || ""
}

async function findRepoRoot(startDir) {
    let current = path.resolve(startDir)

    while (true) {
        if (await fileExists(path.join(current, ".git")))
            return current

        const parent = path.dirname(current)
        if (parent === current)
            return ""

        current = parent
    }
}

async function resolveRunTargets({ phasePlanPath, phase, stage, step, includeChecked }) {
    if (step && !stage)
        throw new Error("A step can only be used when stage is set.")

    if (stage) {
        const stageFiles = await discoverStageFiles(phasePlanPath)
        const detailedStage = stageFiles.find((entry) => entry.stage === stage) || null

        if (stageFiles.length > 0 && !detailedStage && !isStagePlanPath(phasePlanPath)) {
            throw new Error(
                `Stage ${stage} was not found under ${getStageDirectoryPath(phasePlanPath)}.`
            )
        }

        const stagePlanPath = detailedStage?.path || null

        if (step) {
            // Single specific step requested
            return [
                createRunTarget({
                    phase,
                    stage,
                    step,
                    stepText: null,
                    phasePlanPath,
                    stagePlanPath,
                }),
            ]
        }

        // All steps in this stage
        return await resolveStepTargets({
            phase,
            stage,
            phasePlanPath,
            stagePlanPath,
            includeChecked,
        })
    }

    if (isStagePlanPath(phasePlanPath)) {
        throw new Error("Phase-wide runs need a phase plan file, not a stage-specific file.")
    }

    const stageFiles = await discoverStageFiles(phasePlanPath)
    if (stageFiles.length === 0) {
        // No stage files found — fall back to phase-level target (discover steps
        // directly from the phase plan, or treat the whole phase as one target).
        return await resolveStepTargets({
            phase,
            stage: "",
            phasePlanPath,
            stagePlanPath: null,
            includeChecked,
        })
    }

    const targets = []
    for (const stageFile of stageFiles) {
        const stageTargets = await resolveStepTargets({
            phase,
            stage: stageFile.stage,
            phasePlanPath,
            stagePlanPath: stageFile.path,
            includeChecked,
        })
        targets.push(...stageTargets)
    }

    return targets
}

function createRunTarget({ phase, stage, step, stepText, phasePlanPath, stagePlanPath }) {
    return {
        phase,
        stage: stage || null,
        step: step || null,
        stepText: stepText || null,
        phasePlanPath,
        stagePlanPath,
    }
}

async function discoverStageFiles(phasePlanPath) {
    const stageDirectory = getStageDirectoryPath(phasePlanPath)
    if (!await fileExists(stageDirectory))
        return []

    const entries = await readdir(stageDirectory, { withFileTypes: true })
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
            const match = entry.name.match(/^stage[_-](\d+)(?:[_-].+)?\.md$/i)
            if (!match)
                return null

            return {
                stage: String(Number.parseInt(match[1], 10)),
                stageNumber: Number.parseInt(match[1], 10),
                path: path.join(stageDirectory, entry.name),
            }
        })
        .filter(Boolean)
        .sort((left, right) => left.stageNumber - right.stageNumber)
}

async function resolveStepTargets({ phase, stage, phasePlanPath, stagePlanPath, includeChecked }) {
    const specPath = stagePlanPath || phasePlanPath
    const steps = await discoverSteps(specPath)

    if (steps.length === 0) {
        // No steps found — fall back to stage-level target
        return [
            createRunTarget({
                phase,
                stage,
                step: null,
                stepText: null,
                phasePlanPath,
                stagePlanPath,
            }),
        ]
    }

    const filteredSteps = includeChecked ? steps : steps.filter((s) => !s.checked)

    if (filteredSteps.length === 0)
        return []

    return filteredSteps.map((s) => createRunTarget({
        phase,
        stage,
        step: String(s.number),
        stepText: s.text,
        phasePlanPath,
        stagePlanPath,
    }))
}

async function discoverSteps(filePath) {
    if (!filePath || !await fileExists(filePath))
        return []

    let content
    try {
        content = await readFile(filePath, "utf-8")
    } catch {
        return []
    }

    const lines = content.split(/\r?\n/)
    const steps = []
    const stepPattern = /^[-*]\s+\[([ xX~>!?-])\]\s+\*\*Step\s+(\d+)\*\*\s*:\s*(.*)/

    for (let i = 0; i < lines.length; i += 1) {
        const match = lines[i].match(stepPattern)
        if (!match)
            continue

        const marker = match[1]
        const checked = marker.toLowerCase() === "x"
        const number = Number.parseInt(match[2], 10)
        const title = match[3].trim()

        // Collect the full step body (indented lines or sub-items until next step or section)
        const bodyLines = [lines[i]]
        for (let j = i + 1; j < lines.length; j += 1) {
            const nextLine = lines[j]
            // Stop at next step, heading, or blank line followed by non-indented content
            if (stepPattern.test(nextLine))
                break
            if (/^#{1,6}\s/.test(nextLine))
                break
            if (nextLine.trim() === "" && j + 1 < lines.length && stepPattern.test(lines[j + 1]))
                break

            bodyLines.push(nextLine)
        }

        steps.push({
            number,
            checked,
            title,
            text: bodyLines.join("\n").trim(),
        })
    }

    // Sort by step number and detect duplicates
    steps.sort((a, b) => a.number - b.number)
    const seen = new Set()
    return steps.filter((s) => {
        if (seen.has(s.number))
            return false
        seen.add(s.number)
        return true
    })
}

async function updateStepMarkerInFile(filePath, stepNumber, newMarker) {
    if (!filePath || !await fileExists(filePath))
        return false

    let content
    try {
        content = await readFile(filePath, "utf-8")
    } catch {
        return false
    }

    const stepPattern = new RegExp(
        `^([-*]\\s+\\[)[ xX~>!?-](\\]\\s+\\*\\*Step\\s+${stepNumber}\\*\\*)`,
        "m"
    )

    const updated = content.replace(stepPattern, `$1${newMarker}$2`)
    if (updated === content)
        return false

    try {
        await writeFile(filePath, updated, "utf-8")
        return true
    } catch {
        return false
    }
}

async function discoverAllPhases(repoRoot) {
    const phasesDirectory = path.join(repoRoot, "docs", "phases")
    if (!await fileExists(phasesDirectory))
        return []

    const entries = await readdir(phasesDirectory, { withFileTypes: true })
    return entries
        .filter((entry) => entry.isFile()
            && /^phase[_-](\d+)[_-].+\.md$/i.test(entry.name))
        .map((entry) => {
            const match = entry.name.match(/^phase[_-](\d+)/i)
            return {
                phase: String(Number.parseInt(match[1], 10)),
                phaseNumber: Number.parseInt(match[1], 10),
                path: path.join(phasesDirectory, entry.name),
            }
        })
        .sort((a, b) => a.phaseNumber - b.phaseNumber)
}

function isAllPhasesValue(value) {
    const trimmed = String(value || "").trim().toLowerCase()
    return ALL_PHASE_VALUES.has(trimmed)
}

function buildAttachments(target) {
    const seen = new Set()
    const attachments = []

    for (const filePath of [target.phasePlanPath, target.stagePlanPath]) {
        if (!filePath || seen.has(filePath))
            continue

        seen.add(filePath)
        attachments.push({ type: "file", path: filePath })
    }

    return attachments
}

function buildSourceOfTruthText(target) {
    if (target.stagePlanPath) {
        return [
            `Use the attached phase spec at ${target.phasePlanPath} and the attached detailed stage spec at ${target.stagePlanPath} as the source of truth.`,
            "If the files differ in detail, follow the stage spec for this stage and use the phase spec for broader constraints.",
        ].join(" ")
    }

    return `Use the attached plan/spec file at ${target.phasePlanPath} as the source of truth.`
}

function normalizePhaseValue(value) {
    const trimmed = String(value || "").trim()
    if (!trimmed)
        return ""

    const phaseNumber = getNormalizedNumber(trimmed)
    return phaseNumber ? String(phaseNumber) : trimmed
}

function normalizeStageValue(value) {
    const trimmed = String(value || "").trim()
    if (!trimmed)
        return ""

    if (ALL_STAGE_VALUES.has(trimmed.toLowerCase()))
        return ""

    const stageNumber = getNormalizedNumber(trimmed)
    return stageNumber ? String(stageNumber) : trimmed
}

function getNormalizedNumber(value) {
    const match = String(value || "").match(/\d+/)
    if (!match)
        return null

    const numeric = Number.parseInt(match[0], 10)
    return Number.isFinite(numeric) ? numeric : null
}

function isStagePlanPath(filePath) {
    return /^stage[_-]/i.test(path.basename(filePath, path.extname(filePath)))
}

function getStageDirectoryPath(phasePlanPath) {
    return path.join(
        path.dirname(phasePlanPath),
        path.basename(phasePlanPath, path.extname(phasePlanPath))
    )
}

// ═══════════════════════════════════════════════════════════════════
// PR workflow helpers — create feature branch, commit, PR, merge
// ═══════════════════════════════════════════════════════════════════

async function execInRepo(cwd, command) {
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd,
            timeout: PR_TIMEOUT_MS,
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
        })
        return { ok: true, output: (stdout || "").trim(), stderr: (stderr || "").trim() }
    } catch (error) {
        return {
            ok: false,
            output: (error.stdout || "").trim(),
            stderr: (error.stderr || error.message || "").trim(),
        }
    }
}

async function getDefaultBranch(cwd) {
    const symRef = await execInRepo(cwd, "git symbolic-ref refs/remotes/origin/HEAD")
    if (symRef.ok && symRef.output)
        return symRef.output.replace(/^refs\/remotes\/origin\//, "")

    const mainCheck = await execInRepo(cwd, "git rev-parse --verify main")
    if (mainCheck.ok)
        return "main"

    const masterCheck = await execInRepo(cwd, "git rev-parse --verify master")
    if (masterCheck.ok)
        return "master"

    return "main"
}

function buildFeatureBranchName(target) {
    const parts = []
    if (target.phase) parts.push(`p${target.phase}`)
    if (target.stage) parts.push(`s${target.stage}`)
    if (target.step) parts.push(`step${target.step}`)
    return `phase-loop/${parts.join("-")}`
}

function extractStepTitle(target) {
    if (!target.stepText)
        return ""

    const firstLine = target.stepText.split("\n")[0] || ""
    const match = firstLine.match(/\*\*Step\s+\d+\*\*\s*:\s*(.+)/)
    if (match)
        return match[1].trim()

    return firstLine
        .replace(/^[-*]\s+\[.\]\s+/, "")
        .replace(/\*\*/g, "")
        .trim()
}

function buildPRTitle(target, evaluation) {
    const scope = `Phase ${target.phase}`
        + (target.stage ? ` / Stage ${target.stage}` : "")
        + (target.step ? ` / Step ${target.step}` : "")
    const stepTitle = extractStepTitle(target)
    const scoreTag = evaluation ? ` [Score: ${evaluation.score}%]` : ""
    return stepTitle
        ? `${scope}: ${stepTitle}${scoreTag}`
        : `${scope}${scoreTag}`
}

function buildPRBody(target, evaluation) {
    const lines = []
    const titleNoScore = buildPRTitle(target, null)
    lines.push(`## ${titleNoScore}`)
    lines.push("")

    if (evaluation) {
        lines.push(`**Evaluator Score:** ${evaluation.score}%`)
        lines.push("")
        if (evaluation.summary) {
            lines.push(`**Summary:** ${evaluation.summary}`)
            lines.push("")
        }
        if (evaluation.gaps && evaluation.gaps.length > 0) {
            lines.push("### Remaining Gaps (low priority)")
            for (const gap of evaluation.gaps) {
                lines.push(`- **[${gap.priority}]** ${gap.title}: ${gap.details}`)
            }
            lines.push("")
        }
    }

    if (target.stepText) {
        lines.push("### Step Specification")
        lines.push("")
        lines.push("```markdown")
        lines.push(target.stepText)
        lines.push("```")
        lines.push("")
    }

    lines.push("---")
    lines.push("*Auto-generated by phase-loop extension*")
    return lines.join("\n")
}

function sanitizeForShell(str) {
    return str
        .replace(/"/g, "'")
        .replace(/`/g, "'")
        .replace(/\$/g, "")
        .replace(/\n/g, " ")
        .trim()
}

async function safeUnlink(filePath) {
    try {
        await unlink(filePath)
    } catch { /* ignore */ }
}

async function prepareFeatureBranch(cwd, target) {
    try {
        const baseBranch = await getDefaultBranch(cwd)
        const branchName = buildFeatureBranchName(target)

        const currentResult = await execInRepo(cwd, "git rev-parse --abbrev-ref HEAD")
        const currentBranch = currentResult.ok ? currentResult.output : ""

        // If not on base branch, stash and switch
        if (currentBranch && currentBranch !== baseBranch) {
            await execInRepo(cwd, "git add -A")
            await execInRepo(cwd, "git stash --include-untracked")
            const checkoutResult = await execInRepo(cwd, `git checkout "${baseBranch}"`)
            if (!checkoutResult.ok) {
                await session.log(
                    `phase-loop PR: could not switch to ${baseBranch}: ${checkoutResult.stderr}. Skipping PR workflow for this target.`,
                    { level: "warning" }
                )
                return null
            }
        }

        // Pull latest
        await execInRepo(cwd, `git pull --ff-only origin "${baseBranch}"`)

        // Clean up leftover branches from previous runs
        await execInRepo(cwd, `git branch -D "${branchName}"`)

        // Delete remote branch if it exists (previous run may have left it)
        const remoteDeleteResult = await execInRepo(cwd, `git push origin --delete "${branchName}"`)
        if (remoteDeleteResult.ok) {
            await session.log(
                `phase-loop PR: deleted stale remote branch '${branchName}'.`,
                { level: "info" }
            )
        }
        // Prune stale remote-tracking refs so local state is consistent
        await execInRepo(cwd, "git fetch origin --prune")

        // Create feature branch
        const createResult = await execInRepo(cwd, `git checkout -b "${branchName}"`)
        if (!createResult.ok) {
            await session.log(
                `phase-loop PR: branch creation failed: ${createResult.stderr}. Skipping PR workflow.`,
                { level: "warning" }
            )
            return null
        }

        await session.log(
            `phase-loop PR: on branch '${branchName}' (from '${baseBranch}').`,
            { level: "info" }
        )
        return { branchName, baseBranch }
    } catch (error) {
        await session.log(
            `phase-loop PR: branch prep error: ${error.message}. Skipping PR workflow.`,
            { level: "warning" }
        )
        return null
    }
}

async function createAndMergePR(cwd, branchContext, target, evaluation) {
    const { branchName, baseBranch } = branchContext

    try {
        // Verify we are still on the expected feature branch
        const currentResult = await execInRepo(cwd, "git rev-parse --abbrev-ref HEAD")
        const currentBranch = currentResult.ok ? currentResult.output : ""
        if (currentBranch !== branchName) {
            await session.log(
                `phase-loop PR: expected branch '${branchName}' but found '${currentBranch}'. The generator may have switched branches. Attempting to recover.`,
                { level: "warning" }
            )
            const recoverResult = await execInRepo(cwd, `git checkout "${branchName}"`)
            if (!recoverResult.ok) {
                await session.log(
                    `phase-loop PR: could not recover to '${branchName}': ${recoverResult.stderr}. Skipping PR.`,
                    { level: "error" }
                )
                await returnToBaseBranch(cwd, branchContext)
                return "failed"
            }
        }

        // Stage any remaining uncommitted changes
        await execInRepo(cwd, "git add -A")
        const statusResult = await execInRepo(cwd, "git status --porcelain")
        if (statusResult.ok && statusResult.output) {
            const commitMsg = sanitizeForShell(buildPRTitle(target, evaluation))
            const commitMsgFile = path.join(tmpdir(), `phase-loop-commit-${Date.now()}.txt`)
            await writeFile(commitMsgFile, commitMsg, "utf-8")
            const commitResult = await execInRepo(cwd, `git commit --file="${commitMsgFile}"`)
            await safeUnlink(commitMsgFile)

            if (!commitResult.ok) {
                await session.log(
                    `phase-loop PR: commit failed: ${commitResult.stderr}. Skipping PR.`,
                    { level: "warning" }
                )
                await returnToBaseBranch(cwd, branchContext)
                return "failed"
            }
        }

        // Check if there are any new commits on this branch vs base
        const logResult = await execInRepo(cwd, `git log "${baseBranch}..HEAD" --oneline`)
        if (!logResult.ok || !logResult.output) {
            const headResult = await execInRepo(cwd, "git rev-parse --short HEAD")
            const worktreeResult = await execInRepo(cwd, "git worktree list")
            await session.log(
                [
                    `phase-loop PR: no new commits on '${branchName}' vs '${baseBranch}'. Skipping PR.`,
                    `HEAD: ${headResult.output || "unknown"}.`,
                    `Worktrees: ${worktreeResult.output || "none"}.`,
                    "This is unexpected after a passing step — the generator may not have made changes on this branch.",
                ].join(" "),
                { level: "warning" }
            )
            await returnToBaseBranch(cwd, branchContext)
            return "failed"
        }

        // Push the feature branch — retry with --force-with-lease on non-fast-forward
        let pushResult = await execInRepo(cwd, `git push -u origin "${branchName}"`)
        if (!pushResult.ok) {
            const isNonFastForward = /non-fast-forward|rejected|failed to push/i.test(pushResult.stderr)
            if (isNonFastForward) {
                await session.log(
                    `phase-loop PR: push rejected (non-fast-forward), retrying with --force-with-lease.`,
                    { level: "warning" }
                )
                pushResult = await execInRepo(cwd, `git push --force-with-lease -u origin "${branchName}"`)
            }
            if (!pushResult.ok) {
                await session.log(
                    `phase-loop PR: push failed: ${pushResult.stderr}. Skipping PR.`,
                    { level: "warning" }
                )
                await returnToBaseBranch(cwd, branchContext)
                return "failed"
            }
        }

        // Create PR
        const prTitle = sanitizeForShell(buildPRTitle(target, evaluation))
        const prBody = buildPRBody(target, evaluation)
        const bodyFile = path.join(tmpdir(), `phase-loop-pr-body-${Date.now()}.md`)
        await writeFile(bodyFile, prBody, "utf-8")

        const prCreateResult = await execInRepo(
            cwd,
            `gh pr create --base "${baseBranch}" --head "${branchName}" --title "${prTitle}" --body-file "${bodyFile}"`
        )
        await safeUnlink(bodyFile)

        if (!prCreateResult.ok) {
            await session.log(
                `phase-loop PR: PR creation failed: ${prCreateResult.stderr}. Branch '${branchName}' is pushed — create PR manually.`,
                { level: "warning" }
            )
            await returnToBaseBranch(cwd, branchContext)
            return "pushed_only"
        }

        const prUrl = prCreateResult.output
        await session.log(`phase-loop PR: created ${prUrl}`, { level: "info" })

        // Merge the PR
        const mergeResult = await execInRepo(
            cwd,
            `gh pr merge "${branchName}" --merge --delete-branch`
        )

        if (!mergeResult.ok) {
            await session.log(
                `phase-loop PR: merge failed: ${mergeResult.stderr}. PR is at ${prUrl} — merge manually.`,
                { level: "warning" }
            )
            await returnToBaseBranch(cwd, branchContext)
            return "pushed_only"
        }

        await session.log("phase-loop PR: merged successfully.", { level: "info" })

        // Return to base branch and pull
        await returnToBaseBranch(cwd, branchContext)
        return "merged"
    } catch (error) {
        await session.log(
            `phase-loop PR: workflow error: ${error.message}`,
            { level: "warning" }
        )
        try {
            await returnToBaseBranch(cwd, branchContext)
        } catch { /* best effort */ }
        return "failed"
    }
}

async function returnToBaseBranch(cwd, branchContext) {
    const { baseBranch } = branchContext

    // Stash any leftover working-tree changes before switching
    await execInRepo(cwd, "git add -A")
    await execInRepo(cwd, "git stash --include-untracked")

    await execInRepo(cwd, `git checkout "${baseBranch}"`)
    await execInRepo(cwd, `git pull --ff-only origin "${baseBranch}"`)

    await session.log(
        `phase-loop PR: switched to '${baseBranch}' and pulled latest.`,
        { level: "info" }
    )
}
