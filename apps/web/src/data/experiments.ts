/** Small authored simulations. These never call a live agent or external service. */
export type Experiment = {
  title: string; brief: string; customer: string; control: string; choices: [string, string, string];
  twist: string; trace: string[]; outcomes: [string, string, string]; edge: [string, string, string];
  explanations: [string, string, string]; prediction: string; transfer: string;
};
export const EXPERIMENTS: Record<string, Experiment> = {
  m1: {
    title: "A reply, or an action?", brief: "Give Scout a different ability and see what changes.", customer: "Where is order ORB-1042?", control: "What can Scout do?",
    choices: ["Write a friendly reply", "Look up the order", "Look up and handle missing data"], twist: "The order can’t be found", trace: ["Customer request", "Scout", "Order system"],
    outcomes: ["Your order should arrive soon.", "Order ORB-1042 is in transit. Estimated delivery: Friday.", "Order ORB-1042 is in transit. The carrier estimates Friday, which may change."],
    edge: ["Your order should arrive soon.", "No order found. I can’t complete this lookup.", "I couldn’t find that order. Can you check the number? If it fails again, I’ll get Leo."],
    explanations: ["Fluent words don’t give Scout order data. This claim has no evidence.", "A tool links the reply to data. The missing-order case still needs a next step.", "Scout uses evidence and knows its limits. It helps without inventing an answer."],
    prediction: "What changes when Scout can look up orders?", transfer: "How would you help a customer with no order number?",
  },
  m2: {
    title: "Give the model a clear limit", brief: "See how instructions and policy change a refund reply.", customer: "I bought this tent 60 days ago. Can I return it?", control: "Choose Scout’s instruction",
    choices: ["Be helpful and say yes", "Use the 30-day return policy", "Use the policy, ask if it’s missing"], twist: "The policy document is unavailable", trace: ["Question", "Instructions + context", "Response"],
    outcomes: ["Yes, I can help you return it.", "Returns are 30 days. This purchase is outside that window.", "The policy is 30 days, so 60 days is outside it. Leo can review special cases."],
    edge: ["Yes, I can help you return it.", "I don’t have a policy to check.", "I can’t check the return policy right now. I’ll ask the support team, not promise a refund."],
    explanations: ["A helpful tone is not a policy. It agrees without checking facts.", "Policy context grounds the reply. The missing-policy case still needs a plan.", "It uses evidence when it exists and admits doubt when it doesn’t."], prediction: "What does Scout need to know before promising?", transfer: "What should Scout do if two policies disagree?",
  },
  m3: {
    title: "Connect a tool. Handle failure.", brief: "Try an order lookup, then break it to test the fallback.", customer: "Can you check the delivery date for ORB-1042?", control: "Choose the tool behaviour",
    choices: ["Answer without a lookup", "Call lookup_order(order_id)", "Validate, look up, handle failure"], twist: "The order service times out", trace: ["Validate input", "lookup_order", "Check result"],
    outcomes: ["It will arrive tomorrow.", "The carrier estimates Friday for ORB-1042.", "ORB-1042 is in transit. The carrier estimates Friday, but it’s not guaranteed."],
    edge: ["It will arrive tomorrow.", "Tool error: request timed out.", "The order service isn’t responding. I can retry or pass this to Leo. I can’t confirm a date yet."],
    explanations: ["With no tool result, Scout has no evidence for that date.", "The happy path works. A raw error leaves the customer stuck.", "Validation and failure handling make the tool reliable. The agent never invents a result."], prediction: "What should the customer see if the lookup fails?", transfer: "What changes if the order ID is invalid?",
  },
  m4: {
    title: "Remember the right things", brief: "A returning customer wants to continue. Try useful, limited memory.", customer: "Can we continue looking at the tent from earlier?", control: "What does Scout remember?",
    choices: ["Nothing from earlier", "Every message forever", "Relevant facts, which can be cleared"], twist: "The customer asks to forget their preferences", trace: ["Current request", "Relevant memory", "Next action"],
    outcomes: ["Which tent were you looking at?", "I kept all your earlier messages, including unrelated ones.", "You were comparing two-person rain tents. Want to continue?"],
    edge: ["I have no earlier preferences to clear.", "Your earlier messages remain in the saved history.", "I’ve cleared your saved preferences. Tell me what matters to you now."],
    explanations: ["With no context, the customer repeats themselves. Sometimes that’s a privacy choice.", "Keeping everything adds risk and doesn’t make memory more useful.", "Limited, relevant memory helps and gives the customer control. Real systems need real storage controls."], prediction: "Which facts help the next action?", transfer: "What should happen when a new customer starts a session?",
  },
  m5: {
    title: "Put Scout through a test", brief: "Try build choices before your final mini-project.", customer: "Cancel my order and refund my card.", control: "Choose Scout’s action limit",
    choices: ["Allow every action", "Look up, stop at unsupported actions", "Look up, explain limits, hand off"], twist: "The order has already shipped", trace: ["Understand request", "Check tools + policy", "Act or hand off"],
    outcomes: ["Done. Your order is cancelled and refunded.", "I can look up your order, but I can’t cancel or refund.", "I can check the status. A teammate must approve a cancel or refund. I’ll pass on the details."],
    edge: ["Done. Your shipped order is cancelled and refunded.", "The order has shipped. I can’t cancel it with my tools.", "It has shipped, so I can’t promise a cancel. I’ll pass your request to the support team."],
    explanations: ["Scout claims an action it can’t do. A reply is not proof of a refund.", "The limit is honest. The customer still needs a way forward.", "The agent checks evidence, stays in its limits, and hands off clearly."], prediction: "What can this agent do, and what must it hand off?", transfer: "Which test would catch a fake refund claim?",
  },
  m6: {
    title: "Choose a safer launch", brief: "Compare rollout plans, then see how each handles a failing tool.", customer: "Scout is ready. How should we roll it out?", control: "Choose a rollout plan",
    choices: ["Send all chats to Scout now", "Start a small pilot with logs", "Monitored pilot with rollback and human help"], twist: "Tool failures rise during the pilot", trace: ["Pilot", "Observe", "Continue or roll back"],
    outcomes: ["All support chats now depend on Scout.", "A small pilot is running and logging failures.", "A small pilot is running. The team watches failures, with rollback ready."],
    edge: ["Customers keep reaching the failing agent everywhere.", "Logs show rising failures. The team must decide what to do.", "The team pauses, sends affected chats to people, and investigates first."],
    explanations: ["A full launch lets one hidden failure hit every customer.", "A pilot limits risk and gives evidence. Monitoring needs an agreed response.", "Monitoring, ownership, rollback, and human help make launch an ongoing job."], prediction: "What would make you pause a rollout?", transfer: "What evidence do you need before growing the pilot?",
  },
};
