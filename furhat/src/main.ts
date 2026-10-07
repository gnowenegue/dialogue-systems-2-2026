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

async function newGesture() {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  return fetch(`http://${FURHATURI}/furhat/gesture?blocking=false`, {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({
      name: "newGesture",
      frames: [
        {
          time: [], //ADD THE TIME FRAME OF YOUR LIKING
          persist: true,
          params: {
            //ADD PARAMETERS HERE IN ORDER TO CREATE A GESTURE
          },
        },
        {
          time: [], //ADD TIME FRAME IN WHICH YOUR GESTURE RESETS
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

async function fhGesture(text: string) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  return fetch(
    `http://${FURHATURI}/furhat/gesture?name=${text}&blocking=true`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
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

const dmMachine = setup({
  actors: {
    fhVoice: fromPromise<any, null>(async () => {
      return fhVoice("en-US-EchoMultilingualNeural");
    }),
    fhSay: fromPromise<any, string>(async ({ input }) => {
      return fhSay(input);
    }),
    fhListen: fromPromise<any, null>(async () => {
      return fhListen();
    }),
    fhAttend: fromPromise<any, null>(async () => {
      return fhAttend("CLOSEST");
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
    Greet: {
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
      invoke: {
        src: "fhSay",
        input: ({ context }) => `You said ${context.lastUtterance}`,
        onDone: [
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
    Listen: {
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
