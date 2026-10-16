function idealRssi(x, y, floor, ap, config) {
  const distance = Math.max(Math.hypot(x - ap.x, y - ap.y), 0.1);
  return config.A - 10 * config.PATH_LOSS_EXPONENT * Math.log10(distance)
    - Math.abs(floor - ap.floor) * config.FLOOR_ATTENUATION_DB;
}

module.exports = { idealRssi };
