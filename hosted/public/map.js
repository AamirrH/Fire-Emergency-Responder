function svgNode(name, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function drawFloorPlan(map, size) {
  const plan = building.floor_plans?.find(plan => plan.floor === selected);
  if (!plan) return;
  const scale = size / 20;
  const layer = svgNode('g', { class: 'architecture' });
  const c = plan.corridor;
  layer.append(svgNode('rect', { x: c.x, y: size - c.y - c.height, width: c.width, height: c.height, fill: '#243741' }));
  layer.append(svgNode('text', { x: size / 2, y: size / 2 + .16 * scale, class: 'corridor-label', 'font-size': .46 * scale, 'text-anchor': 'middle' }, c.label));
  for (const room of plan.rooms) {
    const top = size - room.y - room.height;
    const center = room.x + room.width / 2;
    const fill = room.kind === 'stairs' ? '#1d3439' : room.kind === 'restroom' ? '#26313e' : '#182833';
    layer.append(svgNode('rect', { x: room.x, y: top, width: room.width, height: room.height, fill, stroke: '#8299a5', 'stroke-width': .12 * scale }));
    const labelY = top + room.height * .49;
    layer.append(svgNode('text', { x: center, y: labelY - .55 * scale, class: 'room-number', 'font-size': .4 * scale, 'text-anchor': 'middle' }, `ROOM ${room.id}`));
    // Two lines keep labels readable in smaller service rooms.
    const words = room.label.split(' ');
    const lines = room.width < 5 * scale && words.length > 1 ? words : [room.label];
    lines.forEach((line, index) => layer.append(svgNode('text', { x: center, y: labelY + index * .6 * scale, class: 'room-label', 'font-size': .49 * scale, 'text-anchor': 'middle' }, line)));
    if (room.kind === 'stairs') {
      const stairTop = top + 1.05 * scale;
      for (let step = 0; step <= 5; step++) layer.append(svgNode('path', {
        d: `M ${center - .8 * scale} ${stairTop + step * .24 * scale} h ${1.6 * scale}`,
        stroke: '#688f96', 'stroke-width': .06 * scale, fill: 'none',
      }));
      layer.append(svgNode('path', { d: `M ${center} ${stairTop + 1.3 * scale} v ${-1.5 * scale} m ${-.2 * scale} ${.25 * scale} l ${.2 * scale} ${-.25 * scale} l ${.2 * scale} ${.25 * scale}`, stroke: '#9ac5c4', 'stroke-width': .06 * scale, fill: 'none' }));
    }
    const door = room.door;
    const doorY = door.side === 'south' ? top + room.height : top;
    const hinge = door.x - door.width / 2;
    const swing = door.side === 'south' ? -1 : 1;
    // Erase a true doorway in the wall, then show the leaf and quarter-circle swing.
    layer.append(svgNode('path', { d: `M ${hinge} ${doorY} h ${door.width}`, stroke: fill, 'stroke-width': .19 * scale }));
    layer.append(svgNode('path', { d: `M ${hinge} ${doorY} v ${swing * door.width} M ${hinge} ${doorY + swing * door.width} A ${door.width} ${door.width} 0 0 ${swing < 0 ? 1 : 0} ${hinge + door.width} ${doorY}`, fill: 'none', stroke: '#90a8b2', 'stroke-width': .055 * scale }));
  }
  layer.append(svgNode('rect', { x: 0, y: 0, width: size, height: size, fill: 'none', stroke: '#c0cdd3', 'stroke-width': .18 * scale }));
  map.append(layer);
}
