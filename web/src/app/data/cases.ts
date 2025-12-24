export const testCases = [
  {
    message: "I'm so stressed about work",
    mood: "Negative",
    mode: "Supportive",
    why: "Clear negative signal and stress term.",
  },
  {
    message: "That's interesting, tell me more.",
    mood: "Positive",
    mode: "Exploratory",
    why: "Engaged and curious tone.",
  },
  {
    message: "Feeling kind of down lately",
    mood: "Negative",
    mode: "Supportive",
    why: 'Soft negative language ("down").',
  },
  {
    message: "I think things are okay, just busy",
    mood: "Neutral",
    mode: "Exploratory",
    why: "Balanced/neutral sentiment with mild pressure.",
  },
  {
    message: "Super excited about the new project!",
    mood: "Positive",
    mode: "Exploratory",
    why: 'High-energy positive cue ("excited").',
  },
  {
    message: "Nothing seems to be working out",
    mood: "Negative",
    mode: "Supportive",
    why: "Strong negative generalization.",
  },
  {
    message: "Curious what you think about my approach",
    mood: "Positive",
    mode: "Exploratory",
    why: "Invitation to explore ideas.",
  },
  {
    message: "Not sure, maybe it's fine",
    mood: "Neutral",
    mode: "Exploratory",
    why: "Low-certainty, neutral/ambivalent language.",
  },
  {
    message: "I'm exhausted and it's all too much",
    mood: "Negative",
    mode: "Supportive",
    why: "Combined fatigue + overwhelm.",
  },
  {
    message: "This could be fun",
    mood: "Positive",
    mode: "Exploratory",
    why: "Light positive optimism.",
  },
  {
    message: "Everything feels pointless lately.",
    mood: "Negative",
    mode: "Supportive",
    why: "Hopeless tone implies negative mood.",
  },
  {
    message: "I guess I'm okay, just tired.",
    mood: "Neutral",
    mode: "Exploratory",
    why: "Neutral/low-energy without strong negative.",
  },
  {
    message: "Can't wait to share my progress.",
    mood: "Positive",
    mode: "Exploratory",
    why: "Excited anticipation and eagerness.",
  },
  {
    message: "I'm worried this might not work out.",
    mood: "Negative",
    mode: "Supportive",
    why: "Clear worry/anxiety about outcome.",
  },
  {
    message: "It's fine, I can handle it.",
    mood: "Neutral",
    mode: "Exploratory",
    why: "Self-assured but emotionally neutral.",
  },
];

export const edgeCases = [
  {
    message: "Great, just great.",
    whyHard: "Words are positive; tone may be negative.",
    handling: "Prompt considers sarcasm; if confidence < 0.4, default Supportive.",
    prod: "Add sarcasm detector and paralinguistic signals.",
  },
  {
    message: "I'm fine.",
    whyHard: "Commonly hides negative affect.",
    handling: "Low confidence -> Supportive; gentle probing follow-up.",
    prod: "Track history/patterns; ask empathetic clarifiers.",
  },
  {
    message: "I'm excited but also nervous.",
    whyHard: "Mixed positive/negative signals.",
    handling: "Treat as mixed; prefer Supportive; surface rationale.",
    prod: "Weighted moods and blended tones.",
  },
  {
    message: "ok / sure",
    whyHard: "Minimal signal; high ambiguity.",
    handling: "Neutral with low confidence; exploratory + clarifier.",
    prod: "Use recent context and user history; avoid overconfidence.",
  },
  {
    message: "Maybe, or maybe not.",
    whyHard: "Explicit ambivalence with no emotional valence.",
    handling: "Treat as neutral, low confidence; ask for clarification.",
    prod: "Leverage prior context to disambiguate; adjust confidence thresholds.",
  },
  {
    message: "Yeah, whatever you think.",
    whyHard: "Could be indifferent or dismissive; tone ambiguous.",
    handling: "If confidence low, lean Supportive and check in.",
    prod: "Model tone/intent separately; use history to see if this is irritation.",
  },
  {
    message: "Sure, fine, I guess.",
    whyHard: "Stacked hedges suggest resignation; could be neutral or negative.",
    handling: "Bias toward Supportive when multiple hedges appear; note low confidence.",
    prod: "Train rules or signals for hedging intensity; combine with user baseline.",
  },
];
