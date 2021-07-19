function Logger() {

  var _logger = console;

  this.log = _logger.log;
  this.info = _logger.info;
  this.warn = _logger.warn;
  this.error = _logger.error;
}

module.exports = new Logger();