export function computeBadges(prog, flow) {
  const completed = prog?.completedMissionIds || [];
  const badges = [];

  if (completed.length >= 1) badges.push({ id: "first_step", icon: "🥇", label: "First Step" });
  if (flow.length && completed.length >= Math.ceil(flow.length / 2)) badges.push({ id: "halfway", icon: "🏅", label: "Halfway There" });
  if (flow.length && completed.length >= flow.length) badges.push({ id: "finisher", icon: "🏆", label: "Finisher" });

  const completedTypes = new Set(flow.filter(m => completed.includes(m.id)).map(m => m.type));
  if (completedTypes.has("photo")) badges.push({ id: "photographer", icon: "📸", label: "Photographer" });
  if (completedTypes.has("video")) badges.push({ id: "videographer", icon: "🎥", label: "Videographer" });
  if (completedTypes.has("note")) badges.push({ id: "storyteller", icon: "📝", label: "Storyteller" });
  if (completedTypes.has("quiz")) badges.push({ id: "quizzer", icon: "🧠", label: "Quiz Master" });

  return badges;
}
