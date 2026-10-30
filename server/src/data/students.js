// in-memory store; a restart resets it
export const store = {
  students: [
    { id: 101, name: "Asha", department: "CSE", year: 2 },
    { id: 102, name: "Rahul", department: "IT", year: 3 },
    { id: 103, name: "Meena", department: "CSE", year: 1 },
    { id: 104, name: "Kiran", department: "ECE", year: 4 },
  ],
  nextId: 105,
};
