'use strict';

/**
 * Unit tests for lib/index.js
 */
const expect = require('chai').expect;
const sinon = require('sinon');

const fs = require('fs');

describe('dmitry-dedup', function () {
  const dedup = require('../lib/index.js');
  let logToConsoleStub = null;
  let sandbox = null;
  let writeFileStub = null;
  let readFileStub = null;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
    logToConsoleStub = sandbox.stub(dedup, 'logToConsole');
    writeFileStub = sandbox.stub(fs, 'writeFile');
    readFileStub = sandbox.stub(fs, 'readFile');
  });

  afterEach(function () {
    sandbox.restore();
  })

  it("should be defined", function () {
    expect(dedup).to.be.an('object');
  });

  describe('displayNoFileArg', function () {
    it("displays the no file argument message", function () {
      dedup.displayNoFileArg();

      expect(logToConsoleStub.calledWith(dedup.messages.NO_FILE_ARG)).to.be.true;
    });
  });

  describe('doNotLogChanges', function () {
    it("sets class property `shouldLogChanges` to false", function () {
      dedup.doNotLogChanges();

      expect(dedup.shouldLogChanges).to.be.false;
    });
  });

  describe('logChange', function () {
    it("adds passed values to changeLog array in an object", function () {
      const mockChanges = {
        oldVal: 'mock Old Value',
        newVal: 'mock New Value',
        index: 'mock index'
      };

      dedup.logChange(mockChanges.oldVal, mockChanges.newVal, mockChanges.index);

      expect(dedup.changeLog[dedup.changeLog.length - 1]).to.deep.equal({
        atIndex: mockChanges.index,
        previousValue: mockChanges.oldVal,
        replacedWith: mockChanges.newVal
      });
    });
  });

  describe('prioritize', function () {
    const existingData = {
      "_id": "edu45238jdsnfsj23",
      "email": "mae@bar.com",
      "firstName":  "Ted",
      "lastName": "Masters",
      "address": "44 North Hampton St",
      "entryDate": "2014-05-07T17:31:20+00:00"
    };

    const newerData = {
      "_id": "edu45238jdsnfsj23",
      "email": "mae@bar.com",
      "firstName":  "Theodore",
      "lastName": "Masters",
      "address": "445 North Hampton St",
      "entryDate": "2015-05-07T17:31:20+00:00" // Newer by one year.
    };

    const olderData = {
      "_id": "edu45238jdsnfsj23",
      "email": "mae@bar.com",
      "firstName":  "Teddy",
      "lastName": "Masters",
      "address": "4 North Hampton St",
      "entryDate": "2013-05-07T17:31:20+00:00" // Older by one year.
    };

    const equalAgeButDifferentData = {
      "_id": "shouldBeANewID",
      "email": "mae@bar.com",
      "firstName":  "Ted",
      "lastName": "Masters",
      "address": "44 North Hampton St",
      "entryDate": "2014-05-07T17:31:20+00:00" // Same creation time.
    };

    let logChangeStub = null;

    beforeEach(function () {
      dedup.shouldLogChanges = false;
      dedup.deduped[0] = existingData;
      logChangeStub = sandbox.stub(dedup, 'logChange');
    });

    afterEach(function () {
      dedup.deduped = [];
    });

    it("keeps the existing data if the passed data is older", function () {
      dedup.prioritize(olderData, '0');

      expect(dedup.deduped[0]).to.deep.equal(existingData);
      expect(logChangeStub.called).to.be.false;
    });

    it("replaces the existing data with the duplicate if both are the same age", function () {
      dedup.prioritize(equalAgeButDifferentData, '0');

      expect(dedup.deduped[0]).to.deep.equal(equalAgeButDifferentData);
      expect(logChangeStub.called).to.be.false;
    });

    it("replaces the existing data with the duplicate if the duplicate is newer", function () {
      dedup.prioritize(newerData, '0');

      expect(dedup.deduped[0]).to.deep.equal(newerData);
      expect(logChangeStub.called).to.be.false;
    });

    it("logs the changes if `shouldLogChanges` is true", function () {
      dedup.shouldLogChanges = true;

      dedup.prioritize(newerData, '0');

      expect(logChangeStub.called).to.be.true;
    });
  });

  describe('dedupe', function () {
    const duplicateIds = [{_id: 'identical'}, {_id: 'identical'}];
    const duplicateEmails = [{email: 'identical'}, {email: 'identical'}];
    const nonDuplicateRecords = [{
      _id: 'different',
      email: 'unique@yahoo.com'
    }, {
      _id: 'strange',
      email: 'offsides@different.com'
    }, {
      _id: 'oneOfAKind',
      email: 'personalized@notTheSame.com'
    }];
    let prioritizeStub = null;

    beforeEach(function () {
      prioritizeStub = sandbox.stub(dedup, 'prioritize');
    });

    it("resets class props for deduplication", function () {
      dedup.dedupe([]);

      expect(dedup.deduped).to.be.an.empty.Array;
      expect(dedup.foundIds).to.be.an.empty.Object;
      expect(dedup.foundEmails).to.be.an.empty.Object;
    });

    it("calls prioritize if it finds a duplicate _id", function () {
      dedup.dedupe(duplicateIds);

      expect(prioritizeStub.calledOnce).to.be.true;
    });

    it("calls prioritize if it finds a duplicate email", function () {
      dedup.dedupe(duplicateEmails);

      expect(prioritizeStub.calledOnce).to.be.true;
    });

    it("returns the deduplicated array", function () {
      const result = dedup.dedupe(nonDuplicateRecords);

      expect(result).to.be.instanceof.Array;
      expect(result.length).to.equal(nonDuplicateRecords.length);
      expect(result).to.deep.equal(nonDuplicateRecords);
    });
  });

  describe('manageFiles', function () {
    const goodLeads = require('./mock/mockGoodJsonFormat');
    const badLeads = require('./mock/mockBadJsonFormat');
    let dedupeStub = null;
    let writeDeduplicatedFileStub = null;

    beforeEach(function () {
      dedupeStub = sandbox.stub(dedup, 'dedupe');
      writeDeduplicatedFileStub = sandbox.stub(dedup, 'writeDeduplicatedFile');
    });

    it("deduplicates and writes new files if JSON data is in good format", function () {
      dedupeStub.returns([0, 1, 2]); // Have the dedupe stub return an array with length;

      dedup.manageFiles(null, goodLeads);

      expect(dedupeStub.called).to.be.true;
      expect(writeDeduplicatedFileStub.called).to.be.true;
      expect(logToConsoleStub.called).to.be.false;
    });

    it("doesn't write new files if deduplicated leads length is 0", function () {
      dedupeStub.returns([]);

      dedup.manageFiles(null, goodLeads);

      expect(dedupeStub.called).to.be.true;
      expect(writeDeduplicatedFileStub.called).to.be.false;
      expect(logToConsoleStub.calledWith(dedup.messages.CHECK_JSON_FORMAT)).to.be.true;
    });

    it("doesn't deduplicate or write new files if JSON format is bad", function () {
      dedup.manageFiles(null, badLeads);

      expect(dedupeStub.called).to.be.false;
      expect(writeDeduplicatedFileStub.called).to.be.false;
      expect(logToConsoleStub.calledWith(dedup.messages.CHECK_JSON_FORMAT)).to.be.true;
    });
  });

  describe('writeDeduplicatedFile', function () {
    beforeEach(function () {
      dedup.originalFileLoc = './';
      dedup.originalFileName = 'test-leads.json';
    });

    it("writes a JSON string to a resolved file path", function () {
      const expectedDestFile = '/deduplicated-test-leads.json';
      const testObject = {test: 'object'};

      dedup.shouldLogChanges = false;

      dedup.writeDeduplicatedFile(testObject);

      expect(writeFileStub.called).to.be.true;
      expect(writeFileStub.args[0][0].indexOf(expectedDestFile)).to.not.equal(-1);
      expect(writeFileStub.args[0][1]).to.equal(JSON.stringify(testObject, null, 2));
      expect(writeFileStub.args[0][2]).to.be.a('function');
    });

    it("writes a JSON string to a resolved change file path if `shouldLogChanges` is true", function () {
      const expectedChangeFile = '/deduplicated-changeLog.json';
      const testChangeObject = {change: 'Log'};

      dedup.shouldLogChanges = true;
      dedup.changeLog = testChangeObject;

      dedup.writeDeduplicatedFile({});

      expect(writeFileStub.calledTwice).to.be.true; // Once for the change log file, once for the deduplicated file.
      expect(writeFileStub.args[0][0].indexOf(expectedChangeFile)).to.not.equal(-1);
      expect(writeFileStub.args[0][1]).to.equal(JSON.stringify(testChangeObject, null, 2));
      expect(writeFileStub.args[0][2]).to.be.a('function');
    });
  });

  describe('parseArgs', function () {
    let displayNoFileArgStub = null;
    let optionMethodStub = null;
    const testOption = '-n';

    beforeEach(function () {
      dedup.originalFileLoc = '';
      dedup.originalFileName = '';
      displayNoFileArgStub = sandbox.stub(dedup, 'displayNoFileArg');
      optionMethodStub = sandbox.stub(dedup, dedup.clOpts[testOption]);
    });

    it("calls the no args passed method if no args were passed", function () {
      dedup.parseArgs();

      expect(displayNoFileArgStub.called).to.be.true;
    });

    it("sets original file properties and reads passed file if file is passed", function () {
      dedup.parseArgs('/Base/tests/test-passed-file.json');

      expect(dedup.originalFileLoc).to.equal('/Base/tests');
      expect(dedup.originalFileName).to.equal('test-passed-file.json');
      expect(readFileStub.called).to.be.true;
    });

    it("calls the relevant options method if a found option is passed in", function () {
      dedup.parseArgs('/Base/tests/test-passed-file.json', testOption);

      expect(optionMethodStub.called).to.be.true;
    });
  });
});
