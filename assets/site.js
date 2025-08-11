document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const tz1Select = document.getElementById("tz1");
  const tz2Select = document.getElementById("tz2");
  const start1Input = document.getElementById("start1");
  const end1Input = document.getElementById("end1");
  const start2Input = document.getElementById("start2");
  const end2Input = document.getElementById("end2");
  const overlapDisplay = document.getElementById("overlap-display");

  // --- Timezone Population ---
  function populateTimezones() {
    const timezones = Intl.supportedValuesOf("timeZone");
    timezones.forEach((tz) => {
      const option1 = document.createElement("option");
      option1.value = tz;
      option1.textContent = tz.replace(/_/g, " ");
      tz1Select.appendChild(option1);

      const option2 = document.createElement("option");
      option2.value = tz;
      option2.textContent = tz.replace(/_/g, " ");
      tz2Select.appendChild(option2);
    });

    // Set default values based on the user's example
    tz1Select.value = "Europe/Stockholm"; // CET/CEST
    tz2Select.value = "America/Chicago"; // CST/CDT for Dallas
  }

  // --- Timezone Utilities ---
  // Parse "HH:MM" -> { h, m }
  function parseHM(str) {
    const [h, m] = str.split(":").map(Number);
    return { h, m };
  }

  // Get the current date parts (year, month, day) in a specific IANA timezone
  function getZonedTodayParts(timeZone, baseDate = new Date()) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(baseDate).map((p) => [p.type, p.value])
    );
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
    };
  }

  // Compute the timezone offset (ms) for a given UTC date in a target timezone
  function getTimeZoneOffsetMs(utcDate, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(utcDate).map((p) => [p.type, p.value])
    );
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return asUTC - utcDate.getTime();
  }

  // Build a UTC Date representing HH:MM on "today" in the given timezone, with optional day offset
  function zonedHhMmToUtc(timeZone, hours, minutes, dayOffset = 0) {
    const { year, month, day } = getZonedTodayParts(timeZone);
    const guessUTC = new Date(
      Date.UTC(year, month - 1, day + dayOffset, hours, minutes, 0)
    );
    const tzOffset = getTimeZoneOffsetMs(guessUTC, timeZone);
    // Subtract the tz offset to get the correct UTC instant for that wall time in the zone
    return new Date(guessUTC.getTime() - tzOffset);
  }

  // --- Calculation Logic ---
  function calculateOverlap() {
    const tz1 = tz1Select.value;
    const tz2 = tz2Select.value;
    const start1 = start1Input.value;
    const end1 = end1Input.value;
    const start2 = start2Input.value;
    const end2 = end2Input.value;

    if (!tz1 || !tz2 || !start1 || !end1 || !start2 || !end2) {
      overlapDisplay.innerHTML = "<p>Please fill in all fields.</p>";
      return;
    }

    // Convert wall times in each person's timezone to UTC instants
    const { h: s1h, m: s1m } = parseHM(start1);
    const { h: e1h, m: e1m } = parseHM(end1);
    const { h: s2h, m: s2m } = parseHM(start2);
    const { h: e2h, m: e2m } = parseHM(end2);

    const p1CrossesMidnight = end1 < start1; // string comparison works for HH:MM
    const p2CrossesMidnight = end2 < start2;

    const p1StartUTC = zonedHhMmToUtc(tz1, s1h, s1m, 0);
    const p1EndUTC = zonedHhMmToUtc(tz1, e1h, e1m, p1CrossesMidnight ? 1 : 0);
    const p2StartUTC = zonedHhMmToUtc(tz2, s2h, s2m, 0);
    const p2EndUTC = zonedHhMmToUtc(tz2, e2h, e2m, p2CrossesMidnight ? 1 : 0);

    const overlapStart = new Date(Math.max(p1StartUTC, p2StartUTC));
    const overlapEnd = new Date(Math.min(p1EndUTC, p2EndUTC));

    if (overlapStart < overlapEnd) {
      displayResults(overlapStart, overlapEnd, tz1, tz2);
    } else {
      overlapDisplay.innerHTML = "<p>No overlapping time available.</p>";
    }
  }

  // --- Display Logic ---
  function displayResults(start, end, tz1, tz2) {
    overlapDisplay.innerHTML = ""; // Clear previous results

    const thirtyMinutes = 30 * 60 * 1000;
    const sixtyMinutes = 60 * 60 * 1000;
    let slotsFound = false;
    const timeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };

    // --- 30-Minute Slots ---
    const slotGrid30 = document.createElement("div");
    slotGrid30.className = "slot-grid";
    let currentSlot30 = new Date(start.getTime());
    let has30MinSlots = false;

    while (currentSlot30.getTime() + thirtyMinutes <= end.getTime()) {
      has30MinSlots = true;
      const slotEnd = new Date(currentSlot30.getTime() + thirtyMinutes);
      const slotDiv = document.createElement("div");
      slotDiv.className = "time-slot";
      const p1Time = `${currentSlot30.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz1,
      })} - ${slotEnd.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz1,
      })}`;
      const p2Time = `${currentSlot30.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz2,
      })} - ${slotEnd.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz2,
      })}`;
      slotDiv.innerHTML = `
                        <span class="slot-person1">${p1Time} (${tz1
        .split("/")[1]
        .replace(/_/g, " ")})</span>
                        <span class="slot-person2">${p2Time} (${tz2
        .split("/")[1]
        .replace(/_/g, " ")})</span>`;
      slotGrid30.appendChild(slotDiv);
      currentSlot30.setTime(currentSlot30.getTime() + thirtyMinutes);
    }

    // --- 1-Hour Slots ---
    const slotGrid60 = document.createElement("div");
    slotGrid60.className = "slot-grid";
    let currentSlot60 = new Date(start.getTime());
    let has60MinSlots = false;

    while (currentSlot60.getTime() + sixtyMinutes <= end.getTime()) {
      has60MinSlots = true;
      const slotEnd = new Date(currentSlot60.getTime() + sixtyMinutes);
      const slotDiv = document.createElement("div");
      slotDiv.className = "time-slot";
      const p1Time = `${currentSlot60.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz1,
      })} - ${slotEnd.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz1,
      })}`;
      const p2Time = `${currentSlot60.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz2,
      })} - ${slotEnd.toLocaleTimeString("en-GB", {
        ...timeFormatOptions,
        timeZone: tz2,
      })}`;
      slotDiv.innerHTML = `
                        <span class="slot-person1">${p1Time} (${tz1
        .split("/")[1]
        .replace(/_/g, " ")})</span>
                        <span class="slot-person2">${p2Time} (${tz2
        .split("/")[1]
        .replace(/_/g, " ")})</span>`;
      slotGrid60.appendChild(slotDiv);
      currentSlot60.setTime(currentSlot60.getTime() + thirtyMinutes);
    }

    // --- Append results to display ---
    if (has30MinSlots) {
      slotsFound = true;
      const titleEl = document.createElement("h3");
      titleEl.textContent = "30-Minute Slots";
      overlapDisplay.appendChild(titleEl);
      overlapDisplay.appendChild(slotGrid30);
    }

    if (has60MinSlots) {
      slotsFound = true;
      const titleEl = document.createElement("h3");
      titleEl.textContent = "1-Hour Slots";
      overlapDisplay.appendChild(titleEl);
      overlapDisplay.appendChild(slotGrid60);
    }

    if (!slotsFound) {
      overlapDisplay.innerHTML =
        "<p>Overlap is too short for a 30-min slot.</p>";
    }
  }

  // --- Initial Setup & Event Listeners ---
  function init() {
    populateTimezones();
    calculateOverlap(); // Initial calculation on load

    [
      tz1Select,
      tz2Select,
      start1Input,
      end1Input,
      start2Input,
      end2Input,
    ].forEach((el) => {
      el.addEventListener("change", calculateOverlap);
    });
  }

  init();
});
