import { SLOTS, bankQuestion, type ProfileAnswer, type ProfileQuestion, type ProfileSlot } from "./profiling";

export type ProfileTurn = { question: ProfileQuestion | null; reply: string; questionAudio: string | null; replyAudio: string | null };
export type ConversationPhase = "idle" | "preparing" | "question" | "listening" | "reply" | "complete" | "error";
export type ConversationState = {
  at: number; question: ProfileQuestion; given: (ProfileAnswer | null)[];
  phase: ConversationPhase; reply: string; error: string;
};
export interface ConversationVoice {
  say(url: string | null, text: string): Promise<void>;
  cancel(): void;
}
type TurnRequest = { slot: ProfileSlot | null; answers: ProfileAnswer[]; skipped: boolean };

/** Only real playback completion releases the next conversational step. */
export class ProfileConversation {
  private state: ConversationState = { at: 0, question: bankQuestion(SLOTS[0]!, []), given: [], phase: "idle", reply: "", error: "" };
  private listeners = new Set<() => void>();
  private generation = 0;
  private retryStep: (() => Promise<void>) | null = null;
  private history: ProfileTurn[] = [];
  constructor(private turn: (request: TurnRequest) => Promise<ProfileTurn>, private voice: ConversationVoice, private changed: (answers: ProfileAnswer[]) => void) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private update(patch: Partial<ConversationState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((fn) => fn()); }
  private async attempt(id: number, step: () => Promise<void>) {
    if (id !== this.generation) return;
    this.retryStep = () => this.attempt(id, step);
    try { await step(); }
    catch (error) {
      if (id === this.generation) this.update({ phase: "error", error: error instanceof Error ? error.message : "Please try again." });
    }
  }
  private async ask(id: number, at: number, turn: ProfileTurn) {
    if (id !== this.generation || !turn.question) return;
    this.history[at] = turn;
    this.update({ at, question: turn.question, phase: "question", error: "" });
    await this.attempt(id, async () => {
      this.update({ phase: "question", error: "" });
      await this.voice.say(turn.questionAudio, turn.question!.text);
      if (id === this.generation) this.update({ phase: "listening" });
    });
  }
  start() {
    if (this.state.phase !== "idle") return;
    const id = ++this.generation;
    this.update({ phase: "preparing" });
    return this.attempt(id, async () => {
      this.update({ phase: "preparing", error: "" });
      const turn = await this.turn({ slot: SLOTS[0]!, answers: [], skipped: false });
      await this.ask(id, 0, turn);
    });
  }
  answer(answer: ProfileAnswer | null) {
    // Synchronous lock: a second click cannot submit another answer.
    if (this.state.phase !== "listening") return;
    const at = this.state.at;
    const given = [...this.state.given.slice(0, at), answer];
    const answers = given.filter((a): a is ProfileAnswer => a !== null);
    const id = ++this.generation;
    this.history = this.history.slice(0, at + 1);
    this.update({ given, phase: "preparing", reply: "", error: "" });
    this.changed(answers);
    return this.attempt(id, async () => {
      this.update({ phase: "preparing", error: "" });
      const turn = await this.turn({ slot: SLOTS[at + 1] ?? null, answers, skipped: answer === null });
      if (id !== this.generation) return;
      this.update({ reply: turn.reply });
      await this.attempt(id, async () => {
        this.update({ phase: "reply", error: "" });
        await this.voice.say(turn.replyAudio, turn.reply);
        if (id !== this.generation) return;
        if (turn.question) await this.ask(id, at + 1, turn);
        else this.update({ phase: "complete" });
      });
    });
  }
  back() {
    if (this.state.at === 0) return;
    const at = this.state.at - 1;
    const id = ++this.generation;
    this.voice.cancel();
    this.update({ reply: "", error: "" });
    return this.ask(id, at, this.history[at]!);
  }
  replay() {
    if (this.state.phase !== "listening") return;
    return this.ask(++this.generation, this.state.at, this.history[this.state.at]!);
  }
  retry() { if (this.state.phase === "error") return this.retryStep?.(); }
  dispose() { ++this.generation; this.voice.cancel(); }
}
