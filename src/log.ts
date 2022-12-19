import pino from "pino";
import pretty from "pino-pretty";

const stream = pretty({
  colorize: true,
});

const log = pino(stream);
export default log;
