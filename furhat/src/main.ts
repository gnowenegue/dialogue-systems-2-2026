import { assign, createActor, fromPromise, setup } from "xstate";

const FURHATURI = "127.0.0.1:54321";
const AUDIO_URL =
  "https://raw.githubusercontent.com/kscottz/PiCommander/master/lion_growl.wav";

type Param = Record<string, string | number | boolean>;

type Config = {
  method: "POST" | "GET";
  body?: string | Record<string, unknown>;
};

async function fhFetch(action: string, config: Config, param?: Param) {
  const headers = new Headers();
  headers.append("accept", "application/json");

  if (config.method === "POST" && config.body)
    headers.append("content-type", "application/json");

  const url = new URL(`http://${FURHATURI}/furhat/${action}`);

  if (param) {
    Object.entries(param).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });
  }

  const body =
    typeof config.body === "object" ? JSON.stringify(config.body) : config.body;

  // console.log("url.href :>> ", url.href);

  const response = await fetch(url.href, {
    headers: headers,
    ...config,
    body,
  });

  const result = await response.json();
  console.log(`${action}, ${JSON.stringify(param)}, result :>> `, result);
  return result;
}

const fhVoice = (name: string) =>
  fhFetch("voice", { method: "POST" }, { name });

const fhSay = (text: string) =>
  fhFetch("say", { method: "POST" }, { text, blocking: true });

const fhAudio = (url: string, blocking: boolean) =>
  fhFetch("say", { method: "POST" }, { url, blocking });

const newGesture = () =>
  fhFetch(
    "gesture",
    {
      method: "POST",
      body: {
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
      },
    },
    { blocking: false },
  );

const fhGesture = (name: string, blocking: boolean) =>
  fhFetch("gesture", { method: "POST" }, { name, blocking });

const fhListen = () => fhFetch("listen", { method: "GET" });

const fhAttend = (user: "CLOSEST" | "OTHER" | "RANDOM") =>
  fhFetch("attend", { method: "POST" }, { user });

const fhLed = (red = 0, green = 0, blue = 0) =>
  fhFetch("led", { method: "POST" }, { red, green, blue });

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
          url: AUDIO_URL,
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
                !event.output.message ||
                event.output.message.trim() === "" ||
                event.output.message === "SILENCE"
              );
            },
            actions: () => console.log("\tNo input"),
          },
          {
            target: "Repeat",
            actions: [
              assign({
                lastUtterance: ({ event }) => event.output.message,
              }),
              ({ event }) => console.log("\t", event.output.message),
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
