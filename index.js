const csvToJson = require('csvtojson');
const Scout = require('scoutbook-scout');

const ScoutbookCampingLog = require('scoutbook-activities/activityCamping');
const ScoutbookServiceLog = require('scoutbook-activities/activityService');
const ScoutbookHikingLog = require('scoutbook-activities/activityHiking');


exports.scoutbook_ia_activities_importer = function (scouts, importPath) {
    const supportedActivities = [
        'Camping Log',
        'Service Log',
        'Conservation Service Log',
        'Hiking Log'
    ];

    function stringToDate(stringDate) {
        let date;
        if (stringDate !== '') {
            const dateSegments = stringDate.split('/');
            if (dateSegments.length === 3) {
                date = new Date(dateSegments[2], dateSegments[0]-1, dateSegments[1])
            }
        }
        return date;
    }

    function findScout(scouts, name) {
        let scout = undefined;
        if (scouts) {
            scoutKeys = Object.keys(scouts);
            for (var i=0; i < scoutKeys.length; i++) {
                const k = scoutKeys[i];
                const s = scouts[k];
                if (s.firstName === name.firstName && s.lastName === name.lastName &&
                    (name.middleInitial !== undefined && name.middleInitial === s.middleName.substr(0,1))) {
                    return s;
                }
            }
        }
        return scout;
    }

    function deconstructName(name) {
        let rval;
        if (name) {
            let tokens = name.split(' ');
            if (tokens) {
                if (tokens.length >= 2) {
                    rval = {};
                    rval.firstName = tokens[0];
                    if (tokens.length === 2) {
                        rval.lastName = tokens[1];
                    } else if (tokens.length === 3) {
                        rval.middleInitial = tokens[1];
                        rval.lastName = tokens[2];
                    }
                }
            }
        }
        return rval;
    }

    function matchService(s1, s2) {
        return (s1.scout.bsaId === s2.scout.bsaId &&
            s1.date.getTime() === s2.date.getTime() &&
            s1.hours === s2.hours &&
            s1.location === s2.location);
    }

    return csvToJson()
        .on('header', function (header) {
            console.log(header);
        })
        .fromFile(importPath)
        .then(function (importedData) {
            let serviceList=[];
            let conservationList=[];
            importedData.forEach(activityRecord => {
                const name = activityRecord['Name'];
                const type = activityRecord['Activity Type'];
                const date = stringToDate(activityRecord['Date']);

                const Nights = activityRecord['Nights'];
                const Miles = activityRecord['Miles'];
                const Hours = activityRecord['Hours'];

                const location = activityRecord['Location'];

                const scoutName = deconstructName(name);
                let scout = findScout(scouts, scoutName);

                if (scout) {
                    if (supportedActivities.includes(type)) {
                        const activities = scout.activities;
                        if (type === 'Camping Log') {
                            activities.addCamping( new ScoutbookCampingLog(date,Nights,location, ''));
                        } else if (type === 'Hiking Log') {
                            activities.addHiking(new ScoutbookHikingLog(date,Miles,location, ''));
                        } else if (type === 'Service Log') {
                            serviceList.push({scout: scout, date: date, hours: Hours, location: location});
                        } else if (type === 'Conservation Service Log') {
                            conservationList.push({scout: scout, date: date, hours: Hours, location: location});
                        }
                    }
                }
            });
            serviceList.forEach(service => {
                const activities = service.scout.activities;
                let conservation = false;
                for (let i=0;i<conservationList.length && conservation === false; i++) {
                    conservation = matchService(service, conservationList[i])
                }
                let newService = new ScoutbookServiceLog(service.date,
                    service.hours,service.location, '');
                    newService.conservation = conservation;
                activities.addService(newService);
            })
            return scouts;
        });
};

if (process.argv.length !== 4) {
    console.log(process.argv.length);
    console.log('Usage: ' + process.argv[1] + ' <scoutbook_log.csv file to import> <JSON string of scouts>');
} else {
    const inScouts = JSON.parse(process.argv[3]);
    function addScouts(inScouts) {
        map = {};
        keys = Object.keys(inScouts);
        keys.forEach(key => {
            s = inScouts[key];
            scout = new Scout(s._bsaId, s._firstName, s._middleName, s._lastName, s._suffix);
            map[key] = scout;
        })
        return map;
    }
    scoutMap = addScouts(inScouts);
    exports.scoutbook_ia_activities_importer(scoutMap,process.argv[2])
        .then(function (scouts) {
            console.log(JSON.stringify(scouts));
        })
        .catch(function (err) {
            console.error(err.message);
        });
}

