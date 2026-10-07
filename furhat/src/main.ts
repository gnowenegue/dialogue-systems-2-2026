import { setup, createActor, fromPromise, assign } from "xstate";

const FURHATURI = "127.0.0.1:54321";

async function fhVoice(name: string) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  const encName = encodeURIComponent(name);
  return await fetch(`http://${FURHATURI}/furhat/voice?name=${encName}`, {
    method: "POST",
    headers: myHeaders,
    body: "",
  });
}

async function fhSay(text: string) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  const encText = encodeURIComponent(text);
  const response = await fetch(
    `http://${FURHATURI}/furhat/say?text=${encText}&blocking=true`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
  const result = await response.json();

  return result;
}

async function fhAudio(url: string, blocking: boolean) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  const encUrl = encodeURIComponent(url);
  const response = await fetch(
    `http://${FURHATURI}/furhat/say?url=${encUrl}&blocking=${blocking}`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
  const result = await response.json();
  console.log("fhAudio result :>> ", result);

  return result;
}

async function newGesture() {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  return await fetch(`http://${FURHATURI}/furhat/gesture?blocking=false`, {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({
      name: "newGesture",
      frames: [
        {
          time: [0.35, 1], //ADD THE TIME FRAME OF YOUR LIKING
          persist: true,
          params: {
            BROW_UP_RIGHT: 1,
            BROW_DOWN_LEFT: 1,
            //ADD PARAMETERS HERE IN ORDER TO CREATE A GESTURE
          },
        },
        {
          time: [1.5], //ADD TIME FRAME IN WHICH YOUR GESTURE RESETS
          persist: true,
          params: {
            reset: true,
          },
        },
        //ADD MORE TIME FRAMES IF YOUR GESTURE REQUIRES THEM
      ],
      class: "furhatos.gestures.Gesture",
    }),
  });
}

async function fhGesture(name: string, blocking: boolean) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  const response = await fetch(
    `http://${FURHATURI}/furhat/gesture?name=${name}&blocking=${blocking}`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
  const result = await response.json();
  console.log("fhGesture result :>> ", result);

  return result;
}

async function fhListen() {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");

  const response = await fetch(`http://${FURHATURI}/furhat/listen`, {
    method: "GET",
    headers: myHeaders,
  });
  const result = await response.json();

  return result.message;

  // .then((response) => response.body)
  // .then((body) => body.getReader().read())
  // .then((reader) => reader.value)
  // .then((value) => JSON.parse(new TextDecoder().decode(value)).message);
}

async function fhAttend(user: "CLOSEST" | "OTHER" | "RANDOM") {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");

  const response = await fetch(
    `http://${FURHATURI}/furhat/attend?user=${user}`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
  const result = await response.json();

  return result;
}

async function fhLed(red = 0, green = 0, blue = 0) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");

  const response = await fetch(
    `http://${FURHATURI}/furhat/led?red=${red}&green=${green}&blue=${blue}`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
  const result = await response.json();

  return result;
}

type LEDColor = {
  red?: number;
  green?: number;
  blue?: number;
};

type Gesture = {
  name: string;
  blocking: boolean;
};

type Audio = {
  url: string;
  blocking: boolean;
};

const dmMachine = setup({
  actors: {
    fhVoice: fromPromise<any, null>(async () => {
      return fhVoice("en-US-EchoMultilingualNeural");
    }),
    fhSay: fromPromise<any, string>(async ({ input }) => {
      return fhSay(input);
    }),
    fhAudio: fromPromise<any, Audio>(async ({ input }) => {
      const { url, blocking } = input;
      return fhAudio(url, blocking);
    }),
    fhListen: fromPromise<any, null>(async () => {
      return fhListen();
    }),
    fhAttend: fromPromise<any, null>(async () => {
      return fhAttend("CLOSEST");
    }),
    fhLed: fromPromise<any, LEDColor>(async ({ input }) => {
      const { red, green, blue } = input;
      return fhLed(red, green, blue);
    }),
    fhNewGesture: fromPromise<any, null>(async () => {
      return newGesture();
    }),
    fhGesture: fromPromise<any, Gesture>(async ({ input }) => {
      const { name, blocking } = input;
      return fhGesture(name, blocking);
    }),
  },
}).createMachine({
  id: "root",
  context: {
    lastUtterance: null,
  },
  initial: "Attend",
  states: {
    Attend: {
      entry: () => fhLed(0, 0, 0),
      invoke: {
        src: "fhAttend",
        input: null,
        onDone: {
          target: "Greet",
          actions: ({ event }) => console.log("\t", event.output),
        },
        onError: {
          target: "Fail",
          actions: ({ event }) => console.error(event),
        },
      },
    },
    // Start: { after: { 1000: "Next" } },
    Greet: {
      entry: () => {
        fhLed(255, 0, 0);
        newGesture();
      },
      invoke: {
        src: "fhSay",
        input: "Hello there",
        onDone: {
          target: "Listen",
          actions: ({ event }) => console.log("\t", event.output),
        },
        onError: {
          target: "Fail",
          actions: ({ event }) => console.error(event),
        },
      },
    },
    NoInput: {
      entry: () => {
        fhLed(255, 0, 0);
        fhGesture("Shake", false);
      },
      invoke: {
        src: "fhSay",
        input: "I can't hear you.",
        onDone: {
          target: "Listen",
          actions: ({ event }) => console.log("\t", event.output),
        },
        onError: {
          target: "Fail",
          actions: ({ event }) => console.error(event),
        },
      },
    },
    Repeat: {
      entry: () => fhLed(255, 0, 0),
      invoke: {
        src: "fhSay",
        input: ({ context }) => `You said ${context.lastUtterance}`,
        onDone: [
          {
            target: "Angry",
            guard: ({ context }) =>
              context.lastUtterance?.toLowerCase().includes("angry") ?? false,
            actions: ({ event }) => console.log("\t", event.output),
          },
          {
            target: "Listen",
            actions: ({ event }) => console.log("\t", event.output),
          },
        ],
        onError: {
          target: "Fail",
          actions: ({ event }) => console.error(event),
        },
      },
    },
    Angry: {
      entry: () => {
        fhLed(255, 0, 0);
        fhGesture("ExpressAnger", false);
      },
      invoke: {
        src: "fhAudio",
        input: {
          // url: "https://freesound.org/people/Artninja/sounds/849000/download/849000__artninja__berserker_or_hulk_distressed_screaming_roar_sound_03252026.wav",
          url: "https://raw.githubusercontent.com/kscottz/PiCommander/master/lion_growl.wav",
          blocking: true,
        },
        onDone: {
          target: "Listen",
          actions: ({ event }) => console.log("\t", event.output),
        },
        onError: {
          target: "Fail",
          actions: ({ event }) => console.error(event),
        },
      },
    },
    Listen: {
      entry: () => fhLed(0, 255, 0),
      invoke: {
        src: "fhListen",
        input: null,
        onDone: [
          {
            target: "NoInput",
            guard: ({ event }) => {
              return (
                !event.output ||
                event.output.trim() === "" ||
                event.output === "SILENCE"
              );
            },
            actions: () => console.log("\tNo input"),
          },
          {
            target: "Repeat",
            actions: [
              assign({
                lastUtterance: ({ event }) => event.output,
              }),
              ({ event }) => console.log("\t", event.output),
            ],
          },
        ],
        onError: {
          target: "Fail",
          actions: ({ event }) => console.error(event),
        },
      },
    },
    Fail: {},
  },
});

const actor = createActor(dmMachine).start();
console.log(`[State]: ${actor.getSnapshot().value}`);

actor.subscribe((snapshot) => {
  console.log(`[State] ${snapshot.value}`);
});
