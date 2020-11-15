// deno only
/* eslint-disable class-methods-use-this */
import * as scio from "./scioTypes.ts";
import { ContractBase } from "./ContractBase.ts";

/**
 * You can treat this as a blackbox and do not need to understand this. This
 * SCWorkerRuntime contains the necessary code to get your contract running.
 *
 * However, it is your lucky day if you want to learn more! The goal is to be
 * able to run arbitrary untrusted smart contracts in a secure way. In order to
 * do this, we use webworkers in deno. Deno has a webworker API similar to that
 * of browsers. These web workers are sandboxed quite well. More importantly,
 * there is a convenient message passing system.
 *
 * If it pleasures you, you are free to implement your own worker runtime. You
 * could even create something that abuses the state system and have persistent
 * state instead of getting a new state each time!
 *
 * There are 4 things that SCWorkerRuntime needs to handle (in the order that
 * it is usually used):
 *   1. stateAndTest: Sets the state and runs the _test() function
 *   2. replaceState: Setting the state (and storing it here)
 *   3. events: Long-lived handling of events. The main way of interaction
 *   4. extractState: Returning the state
 */
export class SCWorkerRuntime<T extends typeof ContractBase> {
  constructor(contractConstructor: T, importMeta: any) {
    console.error(
      `SCWorkerRuntime started!`,
    );

    // @ts-ignore
    const postMessage: (message: any) => void = self.postMessage as any;

    // The code must have compiled or else this function wouldn't be working.
    // Remember, SCWorkerRuntime is called by the contract code.
    postMessage({
      successfullyCompiled: true,
    });

    let bootupSent = false;

    // The init object which is cloned and passed to the contract constructor
    let init: {
      state: any;
    } = {
      state: null, // Fail hard. This default init should never be passed in
    };

    // @ts-ignore
    self.onmessage = (e: MessageEvent) => {
      const m: scio.SCVMMessage = e.data;
      try {
        if (m.runtimeAction === "stateAndTest") {
          init = {
            state: m.state,
          };

          // @ts-ignore
          const contract = new contractConstructor(init);

          try {
            console.error("About to run test");
            contract._test(); // The heart of things!
            console.error("Test has been run");

            if (typeof contract.state !== "object") {
              throw new Error(
                "Contract this.state is not an object. It needs to be an object",
              );
            }
            postMessage({
              testSuccess: true,
            });
          } catch (err) {
            console.error("Test failed! :(");
            console.error(err.stack);

            postMessage({
              testFailure: true,
              message: betterStackTrace(err.stack, importMeta),
            });
          }
        } else if (m.runtimeAction === "replaceState") {
          init = {
            state: m.state,
          };
        } else if (m.runtimeAction === "extractState") {
          postMessage({
            extractState: true,
            state: init.state,
          });
        } else if (m.runtimeAction === "event") {
          // @ts-ignore
          const contract: ContractBase = new contractConstructor(init);

          const event: scio.Event = m.event;

          // @ts-ignore
          const eventHandler = contract[`on${event.type}`];
          try {
            if (typeof eventHandler === `function`) {
              eventHandler.call(contract, event);
              // After calling this function, the state gets mutated.
              // However, the mutation is by design! All we have to do is store
              // a reference to the state. The next line is a defensive measure
              // against the contract reassigning the state to a fresh object,
              // so we can't rely on the contract mutating init.
              init.state = contract.state;
            } else {
              console.error(`No handler found for ${event.type}`);
              // Since we found no handler, we will tell the system to ignore
              // all future events of this type.
              const errorEffect: scio.VMIgnoreEventEffect = {
                type: "VMIgnoreEventEffect",
                eventType: event.type,
              };
              const cwm: scio.ContractWorkerMessage = {
                result: {
                  effects: [errorEffect],
                },
              };
              postMessage(cwm);
            }

            const cwm: scio.ContractWorkerMessage = {
              result: {
                effects: contract.effects,
              },
            };
            return postMessage(cwm);
          } catch (err) {
            let bst = "";
            try {
              bst = betterStackTrace(err.stack, importMeta);
            } catch (e) {
              bst = err.stack;
            }

            const errorEffect: scio.MinecraftBroadcastEffect = {
              type: "MinecraftBroadcastEffect",
              message: `${scio.ChatColor.RED}${betterStackTrace}`,
            };
            const errorcwm: scio.ContractWorkerMessage = {
              result: {
                effects: [errorEffect],
              },
            };
            return postMessage(errorcwm);
          }
        } else {
          console.error(
            `ERROR: Unknown message passed to SCWorkerRuntime:`,
            e.data,
          );
        }
      } catch (e) {
        console.error(e);
      }
      // We must always return something or else we get stuck in async state
      // TODO: Add timeout
      const cwm: scio.ContractWorkerMessage = {
        result: {
          effects: [],
        },
      };
    };
  }
}

function betterStackTrace(stack: string, importMeta: any) {
  // Perform some filtering to make the stack trace pretty
  let betterStackTrace: string = stack;
  const contractFilenamePrefix = new URL(".", importMeta.url).href;
  betterStackTrace = betterStackTrace.replaceAll(
    contractFilenamePrefix,
    "",
  );
  const runtimeFilenamePrefix = new URL(".", import.meta.url).href;
  betterStackTrace = betterStackTrace.replaceAll(
    runtimeFilenamePrefix,
    "",
  );

  let bstLines = betterStackTrace.split("\n");
  let filteredLines = [];
  for (let index in bstLines) {
    if (
      bstLines[index].includes("at __anonymous__:1:1") ||
      bstLines[index].includes("at workerMessageRecvCallback") ||
      bstLines[index].includes("at SCWorkerRuntime.self.onmessage (")
    ) {
      continue;
    } else {
      if (parseInt(index) > 0) {
        filteredLines.push(
          bstLines[index].replace(
            /(at .*)(\(.*\))$/,
            scio.ChatColor.GRAY + "$1" + scio.ChatColor.RED + "$2",
          ),
        );
      } else {
        filteredLines.push(bstLines[index]);
      }
    }
  }

  betterStackTrace = filteredLines.join("\n");
  return betterStackTrace;
}
