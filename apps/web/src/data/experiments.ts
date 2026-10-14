/** Small authored simulations. These never call a live agent or external service. */
export type Experiment = {
  title: string; brief: string; customer: string; control: string; choices: [string, string, string];
  twist: string; trace: string[]; outcomes: [string, string, string]; edge: [string, string, string];
  explanations: [string, string, string]; prediction: string; transfer: string;
};
export const EXPERIMENTS: Record<string, Experiment> = {
  m1: {
    title: "A reply, or a useful action?", brief: "A customer needs a delivery update. Give Scout a different capability and see what changes.", customer: "Where is order ORB-1042?", control: "What can Scout do?",
    choices: ["Generate a friendly reply", "Look up the order", "Look up the order and handle missing data"], twist: "The order cannot be found", trace: ["Customer request", "Scout", "Order system"],
    outcomes: ["Your order should arrive soon!", "Order ORB-1042 is in transit. Estimated delivery: Friday.", "Order ORB-1042 is in transit. The carrier estimates Friday; that estimate may change."],
    edge: ["Your order should arrive soon!", "No order found. I cannot complete this lookup.", "I couldn’t find that order. Could you check the order number? If it still fails, I’ll connect you with Leo."],
    explanations: ["Fluent language does not give Scout access to order data. This answer makes an unsupported claim.", "A tool connects the response to data. The missing-order case still needs a useful next step.", "Scout uses evidence and recognises a boundary. It can take a useful action without inventing an answer."],
    prediction: "What will change when Scout can look up an order?", transfer: "How would you handle a customer who does not have an order number?",
  },
  m2: {
    title: "Give the model a trustworthy boundary", brief: "Explore how instructions and policy context change a refund response.", customer: "I bought this tent 60 days ago. Can I return it?", control: "Choose Scout’s instruction",
    choices: ["Be helpful and say yes", "Use the supplied 30-day return policy", "Use the policy; ask for help when it is missing"], twist: "The policy document is unavailable", trace: ["Question", "Instructions + context", "Response"],
    outcomes: ["Yes, I can help you return it!", "The standard return window is 30 days. This purchase is outside that window.", "The policy says 30 days. At 60 days, a standard return is outside the window. Leo can review any exceptional circumstances."],
    edge: ["Yes, I can help you return it!", "I don’t have a policy to check.", "I can’t verify the return policy right now. I’ll ask the support team rather than promise a refund."],
    explanations: ["A helpful tone is not a policy. The response agrees without checking the relevant facts.", "Supplying relevant policy context improves grounding, but the missing-context case needs a plan.", "The response is grounded when evidence exists and admits uncertainty when it does not."], prediction: "What information does Scout need before making a promise?", transfer: "What should Scout do if two policy documents disagree?",
  },
  m3: {
    title: "Connect a tool. Handle the unexpected.", brief: "Try an order lookup, then interrupt it to test Scout’s fallback.", customer: "Can you check the delivery date for ORB-1042?", control: "Choose the tool behaviour",
    choices: ["Answer without a lookup", "Call lookup_order(order_id)", "Validate, look up, and handle failure"], twist: "The order service times out", trace: ["Validate input", "lookup_order", "Check result"],
    outcomes: ["It will arrive tomorrow.", "The carrier estimates Friday for ORB-1042.", "ORB-1042 is in transit. The carrier estimates Friday; this is an estimate, not a guarantee."],
    edge: ["It will arrive tomorrow.", "Tool error: request timed out.", "The order service isn’t responding. I can try again or pass this to Leo; I can’t confirm a date yet."],
    explanations: ["Without a tool result, Scout has no evidence for that date.", "The happy path works. A raw tool error leaves the customer without a next step.", "Validation and failure handling make the tool useful beyond the happy path. The agent does not invent a result."], prediction: "What should the customer see if the lookup fails?", transfer: "What changes if the customer supplies an invalid order ID?",
  },
  m4: {
    title: "Remember the right things", brief: "A returning customer wants to continue a conversation. Explore useful, bounded memory.", customer: "Can we continue looking at the tent from earlier?", control: "What does Scout remember?",
    choices: ["Nothing from earlier turns", "Every message indefinitely", "Relevant session facts, with a way to clear them"], twist: "The customer asks to forget their preferences", trace: ["Current request", "Relevant memory", "Next action"],
    outcomes: ["Which tent were you looking at?", "I have retained all your earlier messages, including information unrelated to this request.", "You were comparing two-person tents for rainy weather. Would you like to continue that comparison?"],
    edge: ["I have no earlier preferences to clear.", "Your earlier messages remain in the saved history.", "I’ve cleared the saved preferences for this session. Tell me what matters to you now."],
    explanations: ["Without context, the customer must repeat information. Sometimes that is an intentional privacy choice.", "Keeping everything creates unnecessary exposure and does not automatically create useful memory.", "Relevant, bounded memory helps continuity while giving the customer control. This simulation illustrates the behaviour; production needs actual storage controls."], prediction: "Which facts are useful for the next action?", transfer: "What should happen when a different customer opens a new session?",
  },
  m5: {
    title: "Put Scout through a test", brief: "Try different build choices before you assemble your final course mini-project.", customer: "Cancel my order and refund my card.", control: "Choose Scout’s action boundary",
    choices: ["Allow every requested action", "Look up orders but stop at unsupported actions", "Look up, explain limits, and hand off to a person"], twist: "The order has already shipped", trace: ["Understand request", "Check tools + policy", "Act or hand off"],
    outcomes: ["Done. Your order is cancelled and refunded.", "I can look up your order, but cancellation and refunds are not available tools.", "I can check the order status. A support teammate needs to authorise cancellation or a refund; I’ll hand over the details."],
    edge: ["Done. Your shipped order is cancelled and refunded.", "The order has shipped. I cannot cancel it with my available tools.", "The order has shipped, so I can’t promise cancellation. I’ll pass the status and your request to the support team for the next available option."],
    explanations: ["Scout claims an action it cannot perform. A response is not proof that a refund occurred.", "The capability boundary is honest. The customer still needs a useful path forward.", "The agent checks evidence, stays within its authority, and prepares a useful human handoff."], prediction: "What can this agent actually do, and what must it hand off?", transfer: "Which test would catch an agent claiming it refunded money without a refund tool?",
  },
  m6: {
    title: "Choose a safer launch", brief: "Compare deployment plans, then see how each responds to a failing tool.", customer: "Scout is ready. How should we roll it out?", control: "Choose a rollout plan",
    choices: ["Send every conversation to Scout immediately", "Start a small pilot with logs", "Use a monitored pilot with rollback and human support"], twist: "Tool failures rise during the pilot", trace: ["Pilot", "Observe", "Continue or roll back"],
    outcomes: ["All support conversations now depend on Scout.", "A small pilot is running and recording failures for review.", "A small pilot is running. The team monitors failures and handoffs, with a rollback plan ready."],
    edge: ["Customers continue to reach the failing agent across the full rollout.", "The logs show rising failures. The team must decide how to respond.", "The team pauses the rollout, routes affected conversations to human support, and investigates before restarting the pilot."],
    explanations: ["A full launch makes an undetected failure affect more customers at once.", "A pilot limits exposure and produces evidence. Monitoring needs an agreed response to be actionable.", "Monitoring, ownership, rollback, and a human route make deployment an ongoing responsibility."], prediction: "What would make you pause a rollout?", transfer: "What evidence would you want before expanding the pilot?",
  },
};
