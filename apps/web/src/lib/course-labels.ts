/** Display labels only: authored content, audio, routes and progress IDs stay stable. */
const labels = {
  "modules": {
    "m1": "Agent basics",
    "m2": "LLM essentials",
    "m3": "Agent tools",
    "m4": "Memory & planning",
    "m5": "Build & test",
    "m6": "Launch & improve"
  },
  "lessons": {
    "m1-1": "What is an agent?",
    "m1-2": "Agents vs. chatbots",
    "m1-3": "Agent use cases",
    "m1-4": "Agent components",
    "m1-5": "Dev setup",
    "m2-1": "How LLMs work",
    "m2-2": "Models & APIs",
    "m2-3": "Prompt basics",
    "m2-4": "System prompts",
    "m2-5": "Structured outputs",
    "m3-1": "Tool calling",
    "m3-2": "Tool definitions",
    "m3-3": "Build tools",
    "m3-4": "Connect APIs",
    "m3-5": "Tool errors",
    "m4-1": "Memory types",
    "m4-2": "Conversation context",
    "m4-3": "RAG basics",
    "m4-4": "Task planning",
    "m4-5": "The agent loop",
    "m5-1": "Project design",
    "m5-2": "Build the agent",
    "m5-3": "Tools & memory",
    "m5-4": "Test & debug",
    "m5-5": "Evaluate results",
    "m6-1": "Safety & guardrails",
    "m6-2": "Cost & monitoring",
    "m6-3": "Deploy the agent",
    "m6-4": "Multi-agent systems",
    "m6-5": "What’s next?"
  },
  "stages": {
    "hook": "The problem",
    "explainer": "Key concepts",
    "worked": "Worked example",
    "guided": "Guided practice",
    "lab": "Scenarios",
    "gate": "Module quiz",
    "review": "Reflect & review"
  }
};
export function courseLabel(courseId: string, kind: keyof typeof labels, id: string, fallback: string): string {
  const group: Record<string, string> = labels[kind];
  return courseId === "ai-agent" ? group[id] ?? fallback : fallback;
}
