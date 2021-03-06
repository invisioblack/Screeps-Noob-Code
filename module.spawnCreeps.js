module.exports = {
    // manages spawning in indicated room
    run: function (spawnRoom) {
        var globalSpawningStatus = false;

        for (var s in spawnRoom.memory.roomArray.spawns) {
            var testSpawn = Game.getObjectById(spawnRoom.memory.roomArray.spawns[s]);
            if (testSpawn != null && testSpawn.spawning == null && testSpawn.memory.spawnRole != "x") {
                globalSpawningStatus = true;
            }
        }

        if (globalSpawningStatus == false) {
            //All spawns busy, inactive or player lost control of the room
            return -1;
        }

        //Check for sources & minerals
        var numberOfSources = spawnRoom.memory.roomArray.sources.length;
        var numberOfExploitableMineralSources = spawnRoom.memory.roomArray.extractors.length;
        var roomMineralType;

        //Check mineral type of the room
        if (numberOfExploitableMineralSources > 0) {
            // Assumption: There is only one mineral source per room
            var mineral = Game.getObjectById(spawnRoom.memory.roomArray.minerals[0]);
            if (mineral != undefined) {
                roomMineralType = mineral.mineralType;
            }
        }

        // Define spawn minima
        var minimumSpawnOf = [];
        //Volume defined by flags
        minimumSpawnOf["remoteHarvester"] = 0;
        minimumSpawnOf["claimer"] = 0;
        minimumSpawnOf["bigClaimer"] = 0;
        minimumSpawnOf["protector"] = 0;
        minimumSpawnOf["stationaryHarvester"] = 0;
        minimumSpawnOf["remoteStationaryHarvester"] = 0;
        minimumSpawnOf["demolisher"] = 0;
        minimumSpawnOf["distributor"] = 0;
        minimumSpawnOf["energyHauler"] = 0;
        minimumSpawnOf["attacker"] = 0;
        minimumSpawnOf["healer"] = 0;
        minimumSpawnOf["einarr"] = 0;
        minimumSpawnOf["archer"] = 0;
        minimumSpawnOf["scientist"] = 0;
        minimumSpawnOf["transporter"] = 0;
        minimumSpawnOf["SKHarvester"] = 0;
        minimumSpawnOf["SKHauler"] = 0;

        let myFlags = _.filter(Game.flags,{ memory: { spawn: spawnRoom.memory.masterSpawn}});

        // Check for transporter flags
        var transporterFlags = _.filter(myFlags,{ memory: { function: 'transporter'}});
        for (var p in transporterFlags) {
            //Iterate through demolisher flags of this spawn
            minimumSpawnOf.transporter += transporterFlags[p].memory.volume;
        }

        // Check for SK Harvester flags
        var SKHarvesterFlags = _.filter(myFlags,{ memory: { function: 'SKHarvest'}});
        for (var t in SKHarvesterFlags) {
            //Iterate through demolisher flags of this spawn
            if (SKHarvesterFlags[t].memory.volume > 1) {
                minimumSpawnOf.SKHarvester++;
                minimumSpawnOf.SKHauler += (SKHarvesterFlags[t].memory.volume - 1);
            }
        }

        // Check for demolisher flags
        var demolisherFlags = _.filter(myFlags,{ memory: { function: 'demolish'}});
        for (var p in demolisherFlags) {
            //Iterate through demolisher flags of this spawn
            minimumSpawnOf.demolisher += demolisherFlags[p].memory.volume;
        }

        // Check for protector flags
        var protectorFlags = _.filter(myFlags,{ memory: { function: 'protector'}});
        for (var p in protectorFlags) {
            //Iterate through remote source flags of this spawn
            minimumSpawnOf.protector += protectorFlags[p].memory.volume;
        }

        // Check for remote source flags
        var remoteSources = _.filter(myFlags,{ memory: { function: 'remoteSource'}});
        for (var t in remoteSources) {
            //Iterate through remote source flags of this spawn
            minimumSpawnOf.remoteHarvester += remoteSources[t].memory.volume;
        }

        // Check for energy hauling flags
        var energyHaulingFlags = _.filter(myFlags,{ memory: { function: 'haulEnergy'}});
        for (var t in energyHaulingFlags) {
            //Iterate through remote source flags of this spawn
            if (energyHaulingFlags[t].memory.volume > 0) {
                minimumSpawnOf.energyHauler += (energyHaulingFlags[t].memory.volume - 1);
                minimumSpawnOf.remoteStationaryHarvester++;
            }
        }

        // Check for narrow source flags
        var narrowSources = _.filter(myFlags,{ memory: { function: 'narrowSource'}});
        for (var t in narrowSources) {
            //Iterate through remote source flags of this spawn
            minimumSpawnOf.stationaryHarvester ++;
        }

        // Check for active flag "remoteController"
        let vacantFlags = _.filter(myFlags, function (f) {
            if (f.memory.function == "remoteController" && _.filter(Game.creeps, {memory: {currentFlag: f.name}}).length == 0) {
                if (Game.rooms[f.pos.roomName] != undefined) {
                    // Sight on room
                    let controller = Game.rooms[f.pos.roomName].controller;
                    if (controller.owner == undefined && (controller.reservation == undefined || controller.reservation.ticksToEnd < 3000 || f.memory.claim == 1)) {
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    // No sight on room
                    return true;
                }
            }
        });
        minimumSpawnOf.claimer = vacantFlags.length;

        // Check for active flag "attackController"
        var attackController = _.filter(Game.flags,{ memory: { function: 'attackController', spawn: spawnRoom.memory.masterSpawn}});
        for (var t in attackController) {
            minimumSpawnOf.bigClaimer += attackController[t].memory.volume;
        }

        // Check for unit groups
        var groupFlags = _.filter(Game.flags,{ memory: { function: 'unitGroup', spawn: spawnRoom.memory.masterSpawn}});
        for (var g in groupFlags) {

            if (groupFlags[g].memory.attacker != undefined) {
                minimumSpawnOf.attacker += groupFlags[g].memory.attacker;
            }
            if (groupFlags[g].memory.healer != undefined) {
                minimumSpawnOf.healer += groupFlags[g].memory.healer;
            }
            if (groupFlags[g].memory.einarr != undefined) {
                minimumSpawnOf.einarr += groupFlags[g].memory.einarr;
            }
            if (groupFlags[g].memory.apaHatchi != undefined) {
                minimumSpawnOf.apaHatchi += groupFlags[g].memory.apaHatchi;
            }
        }

        /**Spawning volumes scaling with # of sources in room**/
        var constructionSites = spawnRoom.find(FIND_CONSTRUCTION_SITES);
        var constructionOfRampartsAndWalls = 0;

        // Builder
        if (constructionSites.length == 0) {
            minimumSpawnOf.builder = 0;
        }
        else {
            //There are construction sites
            var progress = 0;
            var totalProgress = 0;

            for (var w in constructionSites) {
                progress += constructionSites[w].progress;
                totalProgress += constructionSites[w].progressTotal;
                if (constructionSites[w].structureType == STRUCTURE_RAMPART || constructionSites[w].structureType == STRUCTURE_WALL) {
                    constructionOfRampartsAndWalls++;
                }
            }
            minimumSpawnOf.builder = Math.ceil((totalProgress - progress) / 5000);
        }

        if (minimumSpawnOf.builder > Math.ceil(numberOfSources * 1.5)){
            minimumSpawnOf.builder = Math.ceil(numberOfSources * 1.5);
        }

        // Upgrader
        if (spawnRoom.controller.level == 8) {
            minimumSpawnOf.upgrader = 0;
            if (spawnRoom.storage.store[RESOURCE_ENERGY] > 200000) {
                minimumSpawnOf.upgrader = 1;
            }
        }
        else {
            minimumSpawnOf["upgrader"] = Math.ceil(numberOfSources * 1);
        }

        //Wall Repairer
        if (spawnRoom.memory.roomSecure == true && constructionOfRampartsAndWalls == 0) {
            minimumSpawnOf["wallRepairer"] = 0;
        }
        else {
            minimumSpawnOf["wallRepairer"] = Math.ceil(numberOfSources * 0.5);
        }

        // Distributor
        if (spawnRoom.memory.terminalTransfer != undefined) {
            //ongoing terminal transfer
            minimumSpawnOf["distributor"] = 1;
        }
        else if (spawnRoom.terminal != undefined && spawnRoom.storage != undefined) {
            for (var rs in RESOURCES_ALL) {
                if ((checkTerminalLimits(spawnRoom, RESOURCES_ALL[rs]).amount < 0 && spawnRoom.storage.store[RESOURCES_ALL[rs]] > 0)
                  || checkTerminalLimits(spawnRoom, RESOURCES_ALL[rs]).amount > 0) {
                    minimumSpawnOf["distributor"] = 1;
                    break;
                }
            }
        }

        // EnergyTransporter, Harvester & Repairer
        minimumSpawnOf["energyTransporter"] = minimumSpawnOf.stationaryHarvester;
        minimumSpawnOf["harvester"] = Math.ceil(numberOfSources * 1.5) - minimumSpawnOf.energyTransporter;
        minimumSpawnOf["repairer"] = Math.ceil(numberOfSources * 0.5);

        /** Rest **/
        // Miner
        minimumSpawnOf["miner"] = numberOfExploitableMineralSources;
        if (spawnRoom.storage == undefined || Game.getObjectById(spawnRoom.memory.roomArray.minerals[0]) == null || Game.getObjectById(spawnRoom.memory.roomArray.minerals[0]).mineralAmount == 0 || spawnRoom.memory.resourceLimits[roomMineralType] == undefined || (spawnRoom.storage != undefined && spawnRoom.storage.store[roomMineralType] > spawnRoom.memory.resourceLimits[roomMineralType].minProduction)) {
            minimumSpawnOf.miner = 0;
        }

        // Scientist
        if (spawnRoom.memory.labOrder != undefined) {
            var info = spawnRoom.memory.labOrder.split(":");
            if (info[3] == "prepare" || info[3] == "done") {
                minimumSpawnOf.scientist = 1;
            }
        }

        // Adjustments in case of hostile presence
        if (spawnRoom.memory.hostiles.length > 0) {
            if (spawnRoom.memory.roomArray.towers.length > 0) {
                minimumSpawnOf.protector = spawnRoom.memory.hostiles.length - 1;
            }
            else {
                minimumSpawnOf.protector = spawnRoom.memory.hostiles.length;
            }
            minimumSpawnOf.upgrader = 0;
            minimumSpawnOf.builder = 0;
            minimumSpawnOf.remoteHarvester = 0;
            minimumSpawnOf.miner = 0;
            minimumSpawnOf.distributor = 0;
            minimumSpawnOf.remoteStationaryHarvester = 0;
            minimumSpawnOf.energyHauler = 0;
            minimumSpawnOf.demolisher = 0;
            minimumSpawnOf.wallRepairer *= 2;
        }

        // Measuring number of active creeps
        let allMyCreeps = _.filter(Game.creeps, (c) => c.memory.homeroom == spawnRoom.name && (c.ticksToLive > (c.body.length*3) - 3 || c.spawning == true));
        let counter = _.countBy(allMyCreeps, "memory.role");

        let roleList = (Object.getOwnPropertyNames(minimumSpawnOf));
        for (z in roleList) {
            if (roleList[z] != "length" && counter[roleList[z]] == undefined) {
                counter[roleList[z]] = 0;
            }
        }
        let numberOf = counter;
        numberOf.claimer = 0; //minimumSpawnOf only contains claimer delta. Hence numberOf.claimer is always 0

        //console.log(spawnRoom + ": " + minimumSpawnOf.claimer);

        // Role selection
        let energy = spawnRoom.energyCapacityAvailable;
        let name = undefined;
        let hostiles = spawnRoom.memory.hostiles.length;
        let rcl = spawnRoom.controller.level;

        /*
        let spawnList = this.getSpawnList(spawnRoom,minimumSpawnOf,numberOf);

        if (spawnList != null && spawnList.length > 1) {
            for (let entry in spawnList) {
                console.log("Spawn list " + spawnRoom + ": " + spawnList[entry]);
            }
        }
        */

        //Check whether spawn trying to spawn too many creeps
        let missingBodyParts = 0;
        for(let rn in minimumSpawnOf){
            if(minimumSpawnOf[rn] != undefined && buildingPlans[rn] != undefined) {
                missingBodyParts+=minimumSpawnOf[rn]*buildingPlans[rn][rcl-1].body.length;
            }
        }
        let neededTicksToSpawn = 3 * missingBodyParts;
        let neededTicksThreshold = 1300 * spawnRoom.memory.roomArray.spawns.length;
        if(neededTicksToSpawn > neededTicksThreshold) {
            console.log("<font color=#ff0000 type='highlight'>Warning: Possible bottleneck to spawn creeps needed for room " + spawnRoom.name + "  detected: " + neededTicksToSpawn + " ticks > " + neededTicksThreshold + " ticks</font>");
        }

        // if not enough harvesters
        var rolename;
        if (numberOf.harvester < minimumSpawnOf.harvester) {
            // try to spawn one
            rolename = 'harvester';
            // if we have no harvesters left
            if (numberOf.harvester + numberOf.energyTransporter == 0) {
                // spawn one with what is available
                rolename = 'miniharvester';
            }
        }
        else if (numberOf.energyTransporter < minimumSpawnOf.energyTransporter && (buildingPlans.energyTransporter[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.energyTransporter[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'energyTransporter';
        }
        else if (numberOf.protector < minimumSpawnOf.protector && (buildingPlans.protector[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.protector[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'protector';
        }
        else if (numberOf.claimer < minimumSpawnOf.claimer && (buildingPlans.claimer[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.claimer[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'claimer';
        }
        else if (numberOf.einarr < minimumSpawnOf.einarr && (buildingPlans.einarr[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.einarr[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'einarr';
        }
        else if (numberOf.bigClaimer < minimumSpawnOf.bigClaimer && (buildingPlans.bigClaimer[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.bigClaimer[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'bigClaimer';
        }
        else if (numberOf.attacker < minimumSpawnOf.attacker && (buildingPlans.attacker[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.attacker[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'attacker';
        }
        else if (numberOf.apaHatchi < minimumSpawnOf.apaHatchi && (buildingPlans.apaHatchi[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.apaHatchi[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'archer';
        }
        else if (numberOf.healer < minimumSpawnOf.healer && (buildingPlans.healer[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.healer[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'healer';
        }
        else if (numberOf.stationaryHarvester < minimumSpawnOf.stationaryHarvester && (buildingPlans.stationaryHarvester[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.stationaryHarvester[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'stationaryHarvester';
        }
        else if (numberOf.remoteStationaryHarvester < minimumSpawnOf.remoteStationaryHarvester && (buildingPlans.remoteStationaryHarvester[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.remoteStationaryHarvester[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'remoteStationaryHarvester';
        }
        else if (numberOf.energyHauler < minimumSpawnOf.energyHauler && (buildingPlans.energyHauler[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.energyHauler[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'energyHauler';
        }
        else if (numberOf.remoteHarvester < Math.floor(minimumSpawnOf.remoteHarvester) && (buildingPlans.remoteHarvester[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.remoteHarvester[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'remoteHarvester';
        }
        else if (numberOf.builder < minimumSpawnOf.builder && (buildingPlans.builder[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.builder[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'builder';
        }
        else if (numberOf.distributor < minimumSpawnOf.distributor && (buildingPlans.distributor[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.distributor[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'distributor';
        }
        else if (numberOf.upgrader < minimumSpawnOf.upgrader && (buildingPlans.upgrader[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.upgrader[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'upgrader';
        }
        else if (numberOf.repairer < minimumSpawnOf.repairer && (buildingPlans.repairer[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.repairer[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'repairer';
        }
        else if (numberOf.SKHarvester < minimumSpawnOf.SKHarvester && (buildingPlans.SKHarvester[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.SKHarvester[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'SKHarvester';
        }
        else if (numberOf.SKHauler < minimumSpawnOf.SKHauler && (buildingPlans.SKHauler[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.SKHauler[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'SKHauler';
        }
        else if (numberOf.miner < minimumSpawnOf.miner && (buildingPlans.miner[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.miner[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'miner';
        }
        else if (numberOf.wallRepairer < minimumSpawnOf.wallRepairer && (buildingPlans.wallRepairer[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.wallRepairer[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'wallRepairer';
        }
        else if (numberOf.scientist < minimumSpawnOf.scientist && (buildingPlans.scientist[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.scientist[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'scientist';
        }
        else if (numberOf.demolisher < minimumSpawnOf.demolisher && (buildingPlans.demolisher[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.demolisher[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'demolisher';
        }
        else if (numberOf.transporter < minimumSpawnOf.transporter && (buildingPlans.transporter[rcl-1].minEnergy <= spawnRoom.energyAvailable || buildingPlans.transporter[rcl-2].minEnergy <= spawnRoom.energyAvailable)) {
            rolename = 'transporter';
        }
        else {
            // Surplus spawning
            let container = spawnRoom.find(FIND_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE});
            let containerEnergie = 0;

            for (let e in container) {
                containerEnergie += container[e].store[RESOURCE_ENERGY];
            }
            if (hostiles == 0 && containerEnergie > spawnRoom.energyAvailable * 2.5 && spawnRoom.controller.level < 8) {
                if (numberOf.upgrader < Math.ceil(minimumSpawnOf.upgrader * 2)) {
                    rolename = 'upgrader';
                }
                else {
                    rolename = "---";
                }
            }
            else {
                rolename = "---";
            }
        }
        if (rolename != "---" && rolename != undefined) {
            // Look for unoccupied, active spawn
            let actingSpawn;
            for (var s in spawnRoom.memory.roomArray.spawns) {
                testSpawn = Game.getObjectById(spawnRoom.memory.roomArray.spawns[s]);
                if (testSpawn != null && testSpawn.spawning == null && testSpawn.memory.spawnRole != "x") {
                    actingSpawn = testSpawn;
                    break;
                }
            }
            if (actingSpawn != undefined) {
                // Spawn!
                if (rolename == "claimer") {
                    name = actingSpawn.createCustomCreep(energy, rolename, spawnRoom.memory.masterSpawn, vacantFlags);
                }
                else {
                    name = actingSpawn.createCustomCreep(energy, rolename, spawnRoom.memory.masterSpawn);
                }
                actingSpawn.memory.lastSpawnAttempt = rolename;
                
                if (!(name < 0) && name != undefined) {

                    if (LOG_SPAWN == true) {
                        console.log("<font color=#00ff22 type='highlight'>" + actingSpawn.name + " is spawning creep: " + name + " (" + rolename + ") in room " + spawnRoom.name + ".</font>");
                    }
                    actingSpawn.memory.lastSpawn = rolename;
                }
            }
        }
    },

    getSpawnList: function (spawnRoom, minimumSpawnOf, numberOf) {
        var rcl = spawnRoom.controller.level;
        var energyCapacity = spawnRoom.energyCapacityAvailable;
        var storage;
        if (spawnRoom.storage == undefined) {
            storage = 0;
        }
        else {
            storage = spawnRoom.storage.store[RESOURCE_ENERGY];
        }

        var tableImportance = {
            harvester: {
                name: "harvester",
                prio: 10,
                energyRole: true,
                min: minimumSpawnOf.harvester,
                max: numberOf.harvester,
                minEnergy: buildingPlans.harvester[rcl-1].minEnergy
            },
            stationaryHarvester: {
                name: "stationaryHarvester",
                prio: 100,
                energyRole: true,
                min: minimumSpawnOf.stationaryHarvester,
                max: numberOf.stationaryHarvester,
                minEnergy: buildingPlans.stationaryHarvester[rcl-1].minEnergy
            },
            builder: {
                name: "builder",
                prio: 140,
                energyRole: false,
                min: minimumSpawnOf.builder,
                max: numberOf.builder,
                minEnergy: buildingPlans.builder[rcl-1].minEnergy
            },
            repairer: {
                name: "repairer",
                prio: 170,
                energyRole: false,
                min: minimumSpawnOf.repairer,
                max: numberOf.repairer,
                minEnergy: buildingPlans.repairer[rcl-1].minEnergy
            },
            wallRepairer: {
                name: "wallRepairer",
                prio: 210,
                energyRole: false,
                min: minimumSpawnOf.wallRepairer,
                max: numberOf.wallRepairer,
                minEnergy: buildingPlans.wallRepairer[rcl-1].minEnergy
            },
            miner: {
                name: "miner",
                prio: 200,
                energyRole: false,
                min: minimumSpawnOf.miner,
                max: numberOf.miner,
                minEnergy: buildingPlans.miner[rcl-1].minEnergy
            },
            upgrader: {
                name: "upgrader",
                prio: 160,
                energyRole: false,
                min: minimumSpawnOf.upgrader,
                max: numberOf.upgrader,
                minEnergy: buildingPlans.upgrader[rcl-1].minEnergy
            },
            distributor: {
                name: "distributor",
                prio: 150,
                energyRole: false,
                min: minimumSpawnOf.distributor,
                max: numberOf.distributor,
                minEnergy: buildingPlans.distributor[rcl-1].minEnergy
            },
            energyTransporter: {
                name: "energyTransporter",
                prio: 20,
                energyRole: true,
                min: minimumSpawnOf.energyTransporter,
                max: numberOf.energyTransporter,
                minEnergy: buildingPlans.energyTransporter[rcl-1].minEnergy
            },
            scientist: {
                name: "scientist",
                prio: 220,
                energyRole: false,
                min: minimumSpawnOf.scientist,
                max: numberOf.scientist,
                minEnergy: buildingPlans.scientist[rcl-1].minEnergy
            },
            remoteHarvester: {
                name: "remoteHarvester",
                prio: 130,
                energyRole: true,
                min: minimumSpawnOf.remoteHarvester,
                max: numberOf.remoteHarvester,
                minEnergy: buildingPlans.remoteHarvester[rcl-1].minEnergy
            },
            remoteStationaryHarvester: {
                name: "remoteStationaryHarvester",
                prio: 110,
                energyRole: true,
                min: minimumSpawnOf.remoteStationaryHarvester,
                max: numberOf.remoteStationaryHarvester,
                minEnergy: buildingPlans.remoteStationaryHarvester[rcl-1].minEnergy
            },
            claimer: {
                name: "claimer",
                prio: 40,
                energyRole: false,
                min: minimumSpawnOf.claimer,
                max: numberOf.claimer,
                minEnergy: buildingPlans.claimer[rcl-1].minEnergy
            },
            bigClaimer: {
                name: "bigClaimer",
                prio: 60,
                energyRole: false,
                min: minimumSpawnOf.bigClaimer,
                max: numberOf.bigClaimer,
                minEnergy: buildingPlans.bigClaimer[rcl-1].minEnergy
            },
            protector: {
                name: "protector",
                prio: 30,
                energyRole: false,
                min: minimumSpawnOf.protector,
                max: numberOf.protector,
                minEnergy: buildingPlans.protector[rcl-1].minEnergy
            },
            demolisher: {
                name: "demolisher",
                prio: 230,
                energyRole: true,
                min: minimumSpawnOf.demolisher,
                max: numberOf.demolisher,
                minEnergy: buildingPlans.demolisher[rcl-1].minEnergy
            },
            energyHauler: {
                name: "energyHauler",
                prio: 120,
                energyRole: true,
                min: minimumSpawnOf.energyHauler,
                max: numberOf.energyHauler,
                minEnergy: buildingPlans.energyHauler[rcl-1].minEnergy
            },
            attacker: {
                name: "attacker",
                prio: 80,
                energyRole: false,
                min: minimumSpawnOf.attacker,
                max: numberOf.attacker,
                minEnergy: buildingPlans.attacker[rcl-1].minEnergy
            },
            archer: {
                name: "archer",
                prio: 80,
                energyRole: false,
                min: minimumSpawnOf.apaHatchi,
                max: numberOf.apaHatchi,
                minEnergy: buildingPlans.archer[rcl-1].minEnergy
            },
            healer: {
                name: "healer",
                prio: 90,
                energyRole: false,
                min: minimumSpawnOf.healer,
                max: numberOf.healer,
                minEnergy: buildingPlans.healer[rcl-1].minEnergy
            },
            einarr: {
                name: "einarr",
                prio: 50,
                energyRole: false,
                min: minimumSpawnOf.einarr,
                max: numberOf.einarr,
                minEnergy: buildingPlans.einarr[rcl-1].minEnergy
            },
            transporter: {
                name: "transporter",
                prio: 2400,
                energyRole: false,
                min: minimumSpawnOf.transporter,
                max: numberOf.transporter,
                minEnergy: buildingPlans.transporter[rcl-1].minEnergy
            }
        };

        tableImportance = _.filter(tableImportance, function (x) {
            return (!(x.min == 0 || x.min == x.max || x.max > x.min))
        });
        if (tableImportance.length > 0) {
            tableImportance = _.sortBy(tableImportance, "priority");
            tableImportance.reverse();
            let spawnList = [];
            for ( let c in tableImportance) {
                //console.log("Spawn list " + spawnRoom, " "+ spawnList[entry].name + ": " + (spawnList[entry].min - spawnList[entry].max) );
                for (let i = 0 ; i < (tableImportance[c].min - tableImportance[c].max) ; i++) {
                    spawnList.push(tableImportance[c].name);
                }
            }
            return spawnList;
        }
        else {
            return null;
        }
    }
};
