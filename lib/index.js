'use strict';

const fs = require('fs');
const path = require('path');

const deduplicationService = {
  /**
   * An array to hold the deduplicated values.
   * @type {Array}
   */
  deduped: [],

  /**
   * An object to check for duplicate ids.
   * @type {Object}
   */
  foundIds: {},

  /**
   * An object to check for duplicate emails.
   * @type {Object}
   */
  foundEmails: {},

  /**
   * A log of changes made to the original data
   * @type {Array}
   */
  changeLog: [],

  /**
   * Whether a changeLog file should be created by the module.
   * @type {Boolean}
   */
  shouldLogChanges: true,

  /**
   * A very simple hash of supportd command line options, as well as a handler for required arg not passed.
   * @type {Object}
   */
  clOpts: {
    noFileArg: 'displayNoFileArg',
    '-n': 'doNotLogChanges',
    '--no-log': 'doNotLogChanges'
  },

  /**
   * An object containing string error and informational messages
   * @type {Object}
   */
  messages: {
    NO_FILE_ARG: 'dmitry-dedup usage: dmitry-dedup <path to file> [--log][-l]',
    CHECK_JSON_FORMAT: 'dmitry-dedup: Check format of JSON data and verify leads array is populated',
    CHANGE_LOG_INFO: 'dmitry-dedup: Changes Logged at ',
    PROCESS_COMPLETE: 'dmitry-dedup: Deduplication Complete'
  },

  /**
   * Wrapper function for console.log, primarily for testing purposes.
   * @param  {*} msg - Message to log to console.
   */
  logToConsole: function (msg) {
    console.log(msg);
  },

  /**
   * Display an error message when no filename is passed to the program.
   */
  displayNoFileArg: function () {
    this.logToConsole(this.messages.NO_FILE_ARG);
  },

  /**
   * Sets the class prop `shouldLogChanges` to false in response to the user passing a `-n|--no-log` option.
   */
  doNotLogChanges: function () {
    this.shouldLogChanges = false;
  },

  /**
   * Adds a record of changes to the class changeLog array.
   * @param  {Object} oldVal - The value that was replaced.
   * @param  {Object} newVal - The value it was replaced with.
   * @param  {String} idx - The index in the original array that was overwritten.
   */
  logChange: function (oldVal, newVal, idx) {
    this.changeLog.push({
      atIndex: idx,
      previousValue: oldVal,
      replacedWith: newVal
    });
  },
  
  /**
   * Prioritizes a found duplicate with existing data.  Assumes that the duplicated passed and the data
   * at the passed index have duplicate emails or ids.
   * @param  {Object} duplicate - The data that is a duplicate of one in the deduped array.
   * @param  {String} existingIdx - The string value of the index where the duplicated value has been stored in this.deduped.
   */
  prioritize: function (duplicate, existingIdx) {
    // Convert the entryDate values to Date objects for easier comparison.
    const duplicateDate = new Date(duplicate.entryDate);
    const existingDate = new Date(this.deduped[existingIdx].entryDate);

    // If this duplicate data is older than (or equal to) our current record, just return; we want to keep the newest.
    if (duplicateDate < existingDate) {
      return;
    } else {
    // If it's newer or equal, keep this new one as we know it came later in the list.
      if (this.shouldLogChanges) {
        this.logChange(this.deduped[existingIdx], duplicate, existingIdx);
      }

      this.deduped[existingIdx] = duplicate;
    }
  },

  /**
   * Populates the class deduped array by iterating through provided records and finding duplicates.
   * @param  {Array} leads - An array of leads records objects.
   * @return {Array} - The class copy of the passed array, deduplicated.
   */
  dedupe: function (leads) {
    // Reset class props for fresh deduplication.
    this.deduped = [];
    this.foundIds = {};
    this.foundEmails = {};

    for (let i=0; i<leads.length; i++) {
      const current = leads[i];
      const strIndex = i.toString(); // Changing this to a string to store the index without risk of false falsitives.

      // If either the id or the email is a match to one already in the array, prioritize the current record.
      if (this.foundIds[current._id]) {
        this.prioritize(current, this.foundIds[current._id]);
      } else if (this.foundEmails[current.email]) {
        this.prioritize(current, this.foundEmails[current.email]);
      } else {
      // Otherwise, push the current record to the deduped array and note the index where it can be found.
        this.deduped.push(current);
        this.foundIds[current.id] = strIndex;
        this.foundEmails[current.email] = strIndex;
      }
    }

    return this.deduped;
  },

  /**
   * Callback for fs.Readfile.  Handles the data received from the file by parsing the JSON.  Does some
   * basic checking for expected format and length.
   * @param  {Error} err - Error received from fs.readFile.
   * @param  {String} data - File contents, expected to be JSON.
   */
  manageFiles: function (err, data) {
    // If error received from reading the file, throw it.
    if (err) throw err;

    const leads = JSON.parse(data).leads;
    let result = {};
    let correctFormat = false;
    let dedupeSuccess = false;

    // If `leads` was found on the parsed JSON, pass it to the deduplication method.
    if (leads) {
      correctFormat = true;
      result.leads = this.dedupe(leads);
    }

    // If the deduplication was successful and there is a length to the de-duplicated array, write the
    // deduplicated array to a new file.
    if (result.leads && result.leads.length) {
      dedupeSuccess = true;
      this.writeDeduplicatedFile(result);
    }

    // If either one of these processes failed, display an error message.
    if (!correctFormat || !dedupeSuccess) {
      this.logToConsole(this.messages.CHECK_JSON_FORMAT);
    }
  },

  /**
   * Uses fs to write a JSON-ready leads object to a new file, adjacent to the original leads file.
   * The new file is prepended with 'deduplicated-'.
   * If changes were logged, a changeLog file is also created adjacent to the original leads file.
   * @param  {Object} resultObj - Expects a property "leads" containing an array of deduplicated leads.
   */
  writeDeduplicatedFile: function (resultObj) {
    const jsonResult = JSON.stringify(resultObj, null, 2);
    const newFilePath = path.resolve(this.originalFileLoc, 'deduplicated-' + this.originalFileName);

    if (this.shouldLogChanges) {
      const jsonChanges = JSON.stringify(this.changeLog, null, 2);
      const changeFilePath = path.resolve(this.originalFileLoc, 'deduplicated-changeLog.json');

      fs.writeFile(changeFilePath, jsonChanges, (err, data) => {
        if (err) throw err;
        this.logToConsole(this.messages.CHANGE_LOG_INFO + changeFilePath);
      });
    }

    fs.writeFile(newFilePath, jsonResult, (err, data) => {
      if (err) throw err;
      this.logToConsole(this.messages.PROCESS_COMPLETE);
    })
  },

  /**
   * Very simple parsing of command line args to the program.
   */
  parseArgs: function () {
    const args = Array.prototype.slice.call(arguments);
    const opts = args[1];
    const filename = args[0];

    if (opts && this.clOpts[opts]) {
      this[this.clOpts[opts]]();
    }

    if (filename) {
      // Save original path and filename information for creating the deduplicated JSON
      this.originalFileName = path.basename(filename);
      this.originalFileLoc = path.dirname(filename);

      // Read the provided JSON file
      fs.readFile(filename, this.manageFiles.bind(this));
    } else {
      this[this.clOpts.noFileArg]();
    }
  }
};


module.exports = deduplicationService;
