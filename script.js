/* ------------------- */
/* Import My Libraries */
/* ------------------- */
import PseudoEvent from "./libs/pseudo-events-2.0.0.js";
import datastore from "./libs/datastore-1.0.0.js";

/* ------------------------- */
/* Global Element References */
/* ------------------------- */
const rowContainerDiv = $("#row-container");
const currentDateTag = $("#current-date");

/* ----------------------- */
/* Internal Program States */
/* ----------------------- */
// global hash map of task row metadata
const rowTable = new Map();

// global time event that fires every second
const globalTimeEvent = new PseudoEvent();

// datastore namespace
const taskSaveKey = "saved-tasks";

/* ----------------- */
/* Utility Functions */
/* ----------------- */

// function that returns a 'new Date()' ONLY for a given hour.
// this function was just created as a debugging tool to simulate different hours of the day
function getFakeDateFromHour(setHour) {
    return () => {
        const fakeDate = new Date();
        fakeDate.setHours(setHour === undefined ? fakeDate.getHours() : setHour);
        return fakeDate;
    }
}

// generate mathematical sequence of {12, 1, 2, ..., 12, 1, 2, ...}
function getClockHour(index) {
    const time = (index + 11)%12 + 1;
    const postfix = ~~(index/12)%2 == 0 ? "am" : "pm";
    return { value: time, timePostfix: postfix }
}

// wrap for-loop logic in a 'setInterval' to achieve delay between loop cycles
// (made for animating the row opacity on page load)
function forInterval(start, stop, step, delay, callback) {
    let count = start;
    const routine = setInterval(() => {
        callback(count);
        count += step;
        if (count > stop) clearInterval(routine);
    }, delay);
}

// update individual row each clock tick (every second) with the appropriate time state.
// time state will be "before", "current", or "after" your current time relative to the row's time
function updateRowTimeState(rowMetadata, currentTime) {
    const currentHour = currentTime.getHours();
    const compareHour = rowMetadata.totalHours;
    const rowDiv = rowMetadata.rowDiv;
    const textarea = rowMetadata.textarea;

    // compute whether current time is before, after, or present, relative to each row's local time
    const timeState = currentHour === compareHour
        ? "current" : currentHour > compareHour 
        ? "before" : "after";

    // update the row's class based on it's time state
    // * "time-state-before":
    //      - disables textarea input
    //      - changes css color and background color
    // * "time-state-after"/"time-state-current":
    //      - enables default functionality again
    if (timeState != rowMetadata.currentTimeState) {
        rowDiv.removeClass("time-state-" + rowMetadata.currentTimeState);
        rowMetadata.currentTimeState = timeState;
        rowDiv.addClass("time-state-" + timeState);
        textarea.attr("disabled", timeState === "before");
    }
}

// function responsible for initial generation of task rows
// task rows are generated based on for loop index, initial load time (new Date()), 
// and old saved data in localStorage
function createTaskRow(index, loadTime, savedTasks) {
    const totalHours = index%24; // make sure 'hour' is the same sequence as 'new Date().getHours()'

    // create containers
    const rowDiv = $("<div>");
    const scheduleTimeDiv = $("<div>");
    const taskInfoDiv = $("<div>");
    const saveAreaDiv = $("<div>");

    // create content
    const scheduleTime = $("<p>");
    const textarea = $("<textarea>");
    const saveButton = $("<button>");

    // set content properties
    const clockHour = getClockHour(totalHours);
    $(scheduleTime).text(clockHour.value + clockHour.timePostfix);
    $(saveButton).text("Save");
    $(textarea).text(savedTasks[index] || "");

    // set classes
    $(rowDiv).addClass("row row-load-anim");
    $(scheduleTimeDiv).addClass("schedule-time col-sm-12 col-md-2 col-lg-1");
    $(taskInfoDiv).addClass("task-info col-sm col-lg");
    $(saveAreaDiv).addClass("save-area col-sm-12 col-md-2 col-lg-1");
    $(saveButton).addClass("save-btn");
    $(scheduleTime).addClass("time-label");

    // append content to containers
    $(scheduleTimeDiv).append(scheduleTime);
    $(taskInfoDiv).append(textarea);
    $(saveAreaDiv).append(saveButton);
    
    // append containers
    $(rowDiv).append(scheduleTimeDiv);
    $(rowDiv).append(taskInfoDiv);
    $(rowDiv).append(saveAreaDiv);

    const rowMetadata = {
        rowDiv: $(rowDiv),
        textarea: $(textarea),
        totalHours: totalHours,
        rowIndex: index,
        clockHour: clockHour,
        currentTimeState: undefined,
        getTaskInfo: () => $(textarea).val(),
    }

    updateRowTimeState(rowMetadata, loadTime); // update row immediately
    globalTimeEvent.connect(currentTime => updateRowTimeState(rowMetadata, currentTime)); // update row with time event

    // save metadata about the row inside rowTable with button literal
    rowTable.set($(saveButton)[0], rowMetadata);
    return rowDiv;
}

// reset all localStorage data for this program's datakey, and clear all tasks
function resetSavedTaskInfo() {
    // reset local storage data for task key
    datastore.update(taskSaveKey, oldData => {
        if (!oldData) return {};
        for (let index in oldData) delete oldData[index];
        return oldData
    });

    // update task rows with no text
    for (let set of rowTable) {
        set[1].textarea.text("");
    }
}

// callback for save button click event
function onSaveButtonClicked(event) {
    const rowData = rowTable.get(event.target);

    // if the save button is clicked, AND the row is not in the 'before' time state, then...
    if (rowData && rowData.currentTimeState != "before") {
        datastore.update(taskSaveKey, oldData => {
            oldData = oldData || {};
            oldData[rowData.rowIndex] = rowData.getTaskInfo();
            return oldData
        });
    }
}

// clock heartbeat
function clockTick(currentTime) {
    const localHour = currentTime.getHours();
    const localSec = currentTime.getSeconds();
    const localMin = currentTime.getMinutes();
    const isNewDay = localHour === 0
        && localSec === 0
        && localMin === 0;

    // update local time display in header
    $(currentDateTag).text(currentTime.toLocaleString());

    // if local time is 00:00:00 (12am), reset yesterday's data
    if (isNewDay) resetSavedTaskInfo();
}

function init() {
    // 'debugDate' is for debugging purposes only. call 'getFakeDateFromHour(set_hour)' to
    // simulate your local time at a custom hour.
    let debugDate = getFakeDateFromHour(); // this line is optional and can be removed, but you must change code below

    // without debugDate, 'loadTime' should just be 'new Date()'
    const loadTime = debugDate();
    clockTick(loadTime);

    // for debugging purposes, watch the hours go by in seconds
    // forInterval(1, 500, 1, 1000, index => {
    //     debugDate = getFakeDateFromHour(index);
    // })

    // connect pseudo-events
    globalTimeEvent.strongConnect(clockTick);

    // set heartbeat interval for clock update
    setInterval(() => {
        const time = debugDate(); // without 'debugDate', this should just be 'new Date()'
        globalTimeEvent.fire(time)
    }, 1000);

    // load old task data
    const savedTasks = datastore.get(taskSaveKey, {});

    // generate the task rows
    forInterval(0, 23, 1, 50, index => {
        const rowDiv = createTaskRow(index, loadTime, savedTasks);
        $(rowContainerDiv).append(rowDiv);
    });

    // create main save button click event listener
    $(rowContainerDiv).on("click", onSaveButtonClicked);
}

// wait for page to load then begin the program
$(document).ready(() => init());