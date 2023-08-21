const GREEN_TICK = '\x1b[32m\u2714\x1b[0m';
const GREEN_TEXT = '\x1b[32m%s\x1b[0m';
const YELLOW_TEXT = '\x1b[33m%s\x1b[0m';
const RED_CROSS = '\x1b[31m\u2717\x1b[0m';
const RED_TEXT = '\x1b[31m%s\x1b[0m';

export function logError(errorMessage) {
  console.error(RED_TEXT, errorMessage);
}

export function logCross(errorMessage) {
  console.error(RED_CROSS, errorMessage);
}

export function logSuccess(successMessage) {
  console.log(GREEN_TEXT, successMessage);
}

export function logTick(successMessage) {
  console.log(GREEN_TICK, successMessage);
}

export function logInfo(infoMessage) {
  console.info(YELLOW_TEXT, infoMessage);
}
