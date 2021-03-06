## Dmitry Dedup

A Node Module that accepts a JSON formatted dataset of leads, de-duplicates them, and creates a new data set without duplicates, according to certain prioritization rules.

#### Caveat
I decided to use some of the ES6 syntax that I am learning in my own time on this project as well; the upshot is that this module wants Node v4 or better. NPM will give you a friendly reminder if you npm install this with a lower version of Node.

#### Review the Code
The GitHub repo for this module is [here](https://github.com/dmitrydwhite/dmitry-dedup)

#### Implementation

To download:
```
$ npm install -g dmitry-dedup
```

To use
```
$ dmitry-dedup <path to leads JSON file> [-n|--no-log]
```

The module will create a new JSON file adjacent to the passed leads file, named `deduplicated-<original file name>`.

Additionally, the module will create an additional file logging the changes that it made to the original file, again adjacent to the original file location, and named `deduplicated-changeLog.json`.

If the `-n` or `--no-log` command line option is also passed, the module will not create the changeLog file.

#### Specific Implementation and Prioritization Notes

This module expects the leads data to be in the following format:

```
{"leads": [{
        "_id": "<any unique identifier>",
        "email": "<any unique email>",
        "entryDate": "<a string value that can be converted to a JavaScript Date object>"
    }]
}
```

Any other fields are optional.  However, this module will obliterate the entire older record with a newer record; fields that were present on an old record but not on a new record will NOT be retained.

`_id` and `email` are required to be unique; duplicates in those fields will overwrite older records.  If a duplicate of a record is found but its `entryDate` is equal to the first instance, priority will be given to a record with a higher index (found later) in the list.