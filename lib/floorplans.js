// Illustrative architectural metadata, separate from the RF/pressure model.
// Coordinates use the same bottom-left origin and meter scale as localization.
function createFloorPlans(floors, size) {
  const themes = [
    { name: 'Reception & visitor services', rooms: ['Reception', 'Security', 'Visitor lounge', 'First aid'] },
    { name: 'Workspaces', rooms: ['Open office', 'Meeting room', 'Project studio', 'Break room'] },
    { name: 'Learning & training', rooms: ['Classroom A', 'Classroom B', 'Training lab', 'Library'] },
    { name: 'Research & engineering', rooms: ['Research lab', 'Equipment lab', 'Engineering', 'Workshop'] },
    { name: 'Administration', rooms: ['Finance', 'Conference', 'Administration', 'Staff lounge'] },
    { name: 'Operations', rooms: ['Control room', 'Server room', 'Operations', 'Briefing room'] },
  ];
  const scale = value => value * size / 20;
  return Array.from({ length: floors }, (_, index) => {
    const floor = index + 1;
    const theme = themes[index % themes.length];
    const split = index % 2 ? 11 : 10;
    const lowerSplit = index % 3 === 0 ? 7 : 9;
    const areas = [
      ['stairs', 'Stair A', 0, 12, 4, 8, 'south'],
      ['room', theme.rooms[0], 4, 12, split - 4, 8, 'south'],
      ['room', theme.rooms[1], split, 12, 16 - split, 8, 'south'],
      ['restroom', 'Restrooms', 16, 12, 4, 8, 'south'],
      ['room', theme.rooms[2], 0, 0, lowerSplit, 8, 'north'],
      ['room', theme.rooms[3], lowerSplit, 0, 16 - lowerSplit, 8, 'north'],
      ['stairs', 'Stair B', 16, 0, 4, 8, 'north'],
    ];
    return { floor, name: theme.name,
      corridor: { x: 0, y: scale(8), width: size, height: scale(4), label: 'MAIN CORRIDOR' },
      rooms: areas.map(([kind, label, x, y, width, height, doorSide], room) => ({
        id: `${floor}${String(room + 1).padStart(2, '0')}`, kind, label,
        x: scale(x), y: scale(y), width: scale(width), height: scale(height),
        door: { side: doorSide, x: scale(x + width / 2), width: scale(1.2) },
      })),
    };
  });
}

module.exports = { createFloorPlans };
