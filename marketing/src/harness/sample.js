const flow = [
  { id: "m1", type: "story", day: 1, destination: "Athens", title: "Welcome to Greece!", text: "Seven days, three islands, one family. Every day has a small mission - and every photo you take lands in your memory book.", points: 0 },
  { id: "m2", type: "photo", day: 1, destination: "Athens", title: "First family photo by the sea", text: "Find a spot where you can see the whole bay and take one photo with everyone in it.", points: 100 },
  { id: "m3", type: "puzzle", day: 2, destination: "Athens", title: "The riddle of the Acropolis", text: "I have stood on a hill above the city for 2,400 years, and I am named after a goddess. What am I?", answer: "Parthenon", points: 150 },
  { id: "m4", type: "photo", day: 3, destination: "Naxos", title: "Walk the old village path", text: "Follow the stone path through the village and photograph the most beautiful corner you find.", points: 100 },
  { id: "m5", type: "note", day: 4, destination: "Naxos", title: "Taste something new", text: "Everyone tries one thing they have never eaten before. What was it, and how was it?", points: 80 },
  { id: "m6", type: "photo", day: 5, destination: "Naxos", title: "The waterfall hike", text: "Reach the waterfall and capture the moment you arrive.", points: 120 },
  { id: "m7", type: "photo", day: 6, destination: "Santorini", title: "Blue domes of Santorini", text: "Find a blue dome and take a photo that could be a postcard.", points: 100 },
  { id: "m8", type: "note", day: 7, destination: "Santorini", title: "Our favorite moment", text: "The trip is almost over. What is the one moment you never want to forget?", points: 80 },
];
const people = [["u1", "Maya"], ["u2", "Daniel"], ["u3", "Noa"], ["u4", "Adam"]];
const photo = (n, missionId, who) => ({ id: `p${n}`, missionId, missionTitle: flow.find(m => m.id === missionId).title, downloadURL: `/sample/p${n}.jpg`, contentType: "image/jpeg", participantName: who });
const quote = (n, missionId, who, text) => ({ id: `a${n}`, missionId, participantName: who, text });
export const sample = {
  experience: {
    id: "sample-greece", ownerUid: "owner", name: "Our Greek Island Week", type: "Family Trip", location: "Athens, Naxos, Santorini",
    destinations: ["Athens", "Naxos", "Santorini"], lang: "en", status: "live", joinCode: "MGREECE", paid: true,
    startDate: "2026-07-05", endDate: "2026-07-11", adultsCount: 2, childrenCount: 2, people: 4, story: "A one-week family trip to the Greek islands with two kids, ages 7 and 10.",
    memoryStory: "It started with four backpacks and a ferry ticket. In Athens we stood above the bay and took the first photo of the trip - the one where Adam is still half asleep. Noa solved the riddle of the Acropolis before the rest of us finished reading it.\n\nOn Naxos the days got slower. We followed a stone path through a village with more cats than people, tasted grilled octopus (Daniel: brave; Adam: not convinced), and hiked to a waterfall that was colder than anyone admitted.\n\nSantorini gave us blue domes, a sunset that made everyone stop talking, and one last question: what do we never want to forget? Everyone had a different answer. That is why we wrote them all down.",
    flow,
  },
  media: [photo(1, "m2", "Maya"), photo(2, "m2", "Daniel"), photo(3, "m2", "Noa"), photo(6, "m4", "Daniel"), photo(7, "m4", "Maya"), photo(8, "m4", "Noa"), photo(9, "m6", "Adam"), photo(10, "m6", "Maya"), photo(11, "m6", "Daniel"), photo(4, "m7", "Noa"), photo(5, "m7", "Maya"), photo(12, "m8", "Maya")],
  answers: [
    quote(1, "m3", "Noa", "The Parthenon! I knew it from the first line."),
    quote(2, "m5", "Daniel", "Grilled octopus, straight from the boat. I would order it again tomorrow."),
    quote(3, "m5", "Adam", "I tried one olive. One was enough."),
    quote(4, "m8", "Noa", "Jumping into the water under the waterfall, even though it was freezing."),
    quote(5, "m8", "Maya", "The evening in Santorini when nobody looked at a phone for two whole hours."),
  ],
  progress: people.map(([uid, name], i) => ({ uid, name, completedMissionIds: flow.map(m => m.id), currentMissionIndex: flow.length, points: 730 - i * 40, progressVersion: 2 })),
};
