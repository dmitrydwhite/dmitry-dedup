## Dmitry Dedup

A Node Module that accepts a JSON formatted dataset of leads, de-duplicates them, and creates a new data set without duplicates, according to certain prioritization rules.

#### Caveat
I decided to use some of the ES6 syntax that I am learning in my own time on this project as well; the upshot is that this module wants Node v4 or better. NPM will give you a friendly reminder if you npm install this with a lower version of Node.

#### Implementation

To download:
```
$ npm install dmitry-dedup
```

To use
```
$ dmitry-dedup <path to leads JSON file> [-l|--log]
```

The module will create a new JSON file adjacent to the passed leads file, named `deduplicated-<original file name>`.

If the `-l` or `--log` command line option is also passed, the module will create an additional file logging the changes that it made to the original file, again adjacent to the original file location, and named `deduplicated-changeLog.json`.

#### Specific Implementation Notes

This module expects the leads data to be in the following format:

```
{"leads": [{
        "_id": "<any unique identifier>",
        "email": "<any unique email>",
        "entryDate": "<a string value that can be converted to a JavaScript Date object>"
    }]}
```

Any other fields are optional.  However, this module will obliterate the entire older record with a newer record; fields that were present on an old record but not on a new record will NOT be retained.