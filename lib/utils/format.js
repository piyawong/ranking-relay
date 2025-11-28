/**
 * Utility functions for formatting data
 */

/**
 * Convert Decimal (from Prisma) to number
 *
 * @param decimal - Decimal value from Prisma
 * @returns Number value
 */
function decimalToNumber(decimal) {
  return typeof decimal === 'object' && decimal !== null && typeof decimal.toString === 'function'
    ? parseFloat(decimal.toString())
    : Number(decimal);
}

module.exports = { decimalToNumber };


