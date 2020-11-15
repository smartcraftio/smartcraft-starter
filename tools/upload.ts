import { bgGreen, bgRed, blue, green, magenta, red, yellow } from "./utils.ts";
console.log();
console.log();
// Will be updated when users are encouraged to update
const TOOL_API_VERSION = 1;

// This works better than the built-in prompt. The built-in prompt doesn't work with nodemon.
async function prompt(message: string = "") {
  const buf = new Uint8Array(1024);
  await Deno.stdout.write(new TextEncoder().encode(blue(message + ": ")));
  const n = <number> await Deno.stdin.read(buf);
  return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

type Config = {
  apiKey: string | null;
  tickerSymbol: string | null;

  // The last endpoint used. This makes things faster if one of the alternatives are down.
  chosenEndpoint: string | null;
};

// Starter config that will get loaded
let config: Config = {
  apiKey: null,
  tickerSymbol: null,
  chosenEndpoint: null,
};
// creates a URL relative to the main folder
function createURL(relativePath: string): URL {
  let parentFolder = import.meta.url.replace("tools/upload.ts", "");
  return new URL(relativePath, parentFolder);
}
async function readFile(url: URL): Promise<string> {
  return await Deno.readTextFile(url);
}

async function writeFile(url: URL, content: string): Promise<void> {
  return await Deno.writeTextFile(url, content);
}
async function saveConfig(): Promise<void> {
  return await Deno.writeTextFile(configURL, JSON.stringify(config, null, 2));
}

function isValidScAPIKey(scAPIKey: string): boolean {
  return scAPIKey.match(/scAPI[a-f0-9]{32}/) !== null;
}
function isValidTickerSymbol(tickerSymbol: string): boolean {
  return tickerSymbol.match(/[A-F]{1,6}/) !== null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reportBroken(componentName: string, extraDetails: string): never {
  console.log(
    red(
      `The ${componentName} appears to be broken. Please report this to the smartcraft author for help, or debug it inside upload.ts\n${extraDetails}`,
    ),
  );
  Deno.exit();
}

// Low level fetching
const scFetch = async (
  path: string,
  endpoint: string,
  apiKey: string,
  body: Record<string, any>,
  timeout: number,
): Promise<Record<string, any>> => {
  // if (chosenEndpoint === null) reportBroken("upload tool", "chosenEndpoint is null")
  // if (config.apiKey === "") reportBroken("upload tool", "trying to fetch with an empty api key")

  const responseTextPromise = fetch(endpoint + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  }).then((response) => response.text());

  const possiblyText = await Promise.race([wait(timeout), responseTextPromise]);
  if (!possiblyText) {
    throw new Error(
      `No response after ${Math.round(timeout / 100) / 10} seconds.`,
    );
  }

  let parsedResult = {};
  try {
    parsedResult = JSON.parse(possiblyText);
  } catch (e) {
    reportBroken("API", "Unable to parse json.\n" + e.message);
  }
  return parsedResult;
};

const uploadFetch = async (
  endpoint: string,
  apiKey: string,
  tickerSymbol: string,
  contractCodeFile: string,
): Promise<Record<string, any>> => {
  const uploadResult = await scFetch("/api/upload", endpoint, apiKey, {
    tickerSymbol: tickerSymbol,
    contractCodeFile: contractCodeFile,
  }, 5000);
  return uploadResult;
};

type Whoami = {
  generalUsername: string;
  minecraftUniqueId: string;
  directorOf: string[];
  apiVersion: number;
  denoVersion: string;
};
type APIResponseWhoami = {
  errorCode?: "INVALID_API_KEY";
  error: string;
  apiVersion: number;
  denoVersion: string;
} | Whoami;

function fatalLog(message: string): never {
  console.log(red(message));
  console.log();
  Deno.exit();
}

let networkStatus: undefined | APIResponseWhoami;
/**
 * Test the credentials and also pick a server
 *
 * 3 resulting paths:
 *  - Hard exits if we can't connect to a server of if we are outdated
 *  - Returns false if the credential is invalid (at which point we should prompt the user for a new key)
 *  - Returns true if we can connect and credential is valid
 */
async function testNetworkAndCredentials(apiKey: string): Promise<boolean> {
  // You must test in prod
  console.log("Connecting to smartcraft.io production API server.");

  const errors: { endpoint: string; message: string }[] = [];

  const reorderedEndpoints = [...magenta];
  if (config.chosenEndpoint !== null) {
    // Prioritize chosen endpoint at the top, or if the user somehow reversed engineered the whole thing into a private server
    const index = reorderedEndpoints.indexOf(config.chosenEndpoint);
    if (index > -1) {
      reorderedEndpoints.splice(index, 1);
    }
    reorderedEndpoints.unshift(config.chosenEndpoint);
  }
  // console.log(endpoints);
  // console.log(reorderedEndpoints);

  for (let endpoint of reorderedEndpoints) {
    // The API key is not yet stored at this stage yet because we want to verify that the API key is good first.
    try {
      const whoami: APIResponseWhoami = await scFetch(
        "/api/whoami",
        endpoint,
        apiKey,
        {},
        500,
      ) as any as APIResponseWhoami;
      // console.log(whoami);

      if ("errorCode" in whoami && whoami.errorCode === "INVALID_API_KEY") {
        console.log(
          `Connected to ${endpoint}\n${red(whoami.error)}`,
        );
        return false;
      } else if ("error" in whoami) {
        console.log(
          `Connected to ${endpoint} but errored.\n${red(whoami.error)}`,
        );
        Deno.exit();
      }
      console.log(
        green(
          `Authenticated as ${whoami.generalUsername}. Director of: ${
            whoami.directorOf.join(" ")
          }\n`,
        ),
      );
      if (whoami.denoVersion !== Deno.version.deno) {
        fatalLog(
          `Your deno version does not match with smartcraft. Please switch to the same version.\n` +
            `You: ${Deno.version.deno}\nSmartcraft: ${whoami.denoVersion}\n` +
            `Run this in your terminal: deno upgrade --version ${whoami.denoVersion}`,
        );
      }
      if (whoami.apiVersion !== TOOL_API_VERSION) {
        fatalLog(
          `Your local repository contains tools that are out of date with the latest Smartcraft starter project.\n` +
            `Please fork the latest starter project and move your code over to it.`,
        );
      }
      config.apiKey = apiKey;
      config.chosenEndpoint = endpoint;
      networkStatus = whoami;
      if (config.apiKey !== apiKey && config.chosenEndpoint !== endpoint) {
        saveConfig(); // Only save if there are new changes. Otherwise, race conditions might break things
      } else {
        console.log("Not saving config");
      }
      return true;
    } catch (e) {
      errors.push({
        endpoint: endpoint,
        message: e.message,
      });
    }
  }
  console.log(
    red(`Unable to reach connect to smartcraft.io servers. Attempts:`),
  );
  for (const error of errors) {
    console.log(`  ${error.endpoint}: ${red(error.message)}`);
  }
  Deno.exit();
}

async function promptApiKey(): Promise<void> {
  console.log(
    "First, create an API key. In game, press [t] and run this command: /api",
  );
  console.log(
    "Then, click on the API key, and it should populate your chat bar",
  );
  console.log("You will then be able to select all and Ctrl+C to copy.");
  console.log(
    "The API key will look something like: scAPI8d303example1example1example9b79",
  );
  let validApiKeyPasted = false;
  let attempt = 0;
  while (true) {
    attempt++;
    if (attempt > 10) {
      console.log("Too many failed attempts. Giving up now.");
      Deno.exit();
    }
    const pastedResult = await prompt("\nNow, paste in your API key here");
    if (pastedResult === null) {
      console.log(
        "Script received null input. Try using the nodemonUpload.sh script or manually run this tool: deno run --allow-read --allow-write --allow-net ./tools/upload.ts",
      );
    } else {
      const cleanedResult = pastedResult.replace(/[^a-z^A-Z^0-9]*/g, "");
      if (cleanedResult === "scAPI8d303example1example1example9b79") {
        console.log(
          red(
            "Uhm, you pasted in the example api key. Try pasting the real thing. :')",
          ),
        );
      } else if (isValidScAPIKey(cleanedResult)) {
        console.log(green("API key is in the valid format!"));

        const validateResult = await testNetworkAndCredentials(cleanedResult);
        if (validateResult) {
          // Looks good!
          validApiKeyPasted = true;
          return;
        } else {
          // Server is online, but API key is broken. Lets try again, buddy.
          // Nothing to say here becase testNetworkAndCredentials already provides messaging
        }
      } else if (pastedResult.length === 0) {
        console.log(red(`Saw empty input. To exit this program, use Ctrl+C`));
      } else if (cleanedResult.length === 32) {
        // Just like in base58 and bech32
        console.log(
          red(`You must also paste in the "scAPI" part of the API key`),
        );
      } else {
        const nonAlphaNum = pastedResult.length - cleanedResult.length;

        console.log(
          red(
            `Invalid API key. Input had ${cleanedResult.length} characters of text, but the API key is exactly 37 characters.`,
          ),
        );
        if (nonAlphaNum > 0) {
          console.log(
            `Input had ${cleanedResult.length} characters of non-alphanumerics.`,
          );
        }
        console.log(
          "The API key should look something like: scAPI8d303example1example1example9b79",
        );
      }
    }
  }
}

const configURL = createURL("smartcraft.config.json");

let parsedJson: any;
let interactiveApiKeyConfig = false;
try {
  let configContents = await readFile(configURL);
  try {
    parsedJson = JSON.parse(configContents);
    // Interactive api config is solely based on just the api key
    if (parsedJson.apiKey === undefined) {
      interactiveApiKeyConfig = true;
      console.log(
        yellow(
          `apiKey field inside smartcraft.config.json is missing. It can be re-created interactively here. Alternatively, use Ctrl+C to exit.`,
        ),
      );
    } else if (parsedJson.apiKey === "") {
      console.log(
        yellow(
          `apiKey field inside smartcraft.config.json is empty. It can be configured interactively here. Alternatively, use Ctrl+C to exit.`,
        ),
      );
    } else if (!isValidScAPIKey(parsedJson.apiKey)) {
      console.log(
        yellow(
          `apiKey field inside smartcraft.config.json is invalid. A valid one must include "scAPI". For example: scAPI8d303example1example1example9b79. It can be configured interactively here. Alternatively, use Ctrl+C to exit.`,
        ),
      );
    } else {
      // If this is set, the API key won't be configured
      config.apiKey = parsedJson.apiKey;
    }

    const possiblyChosenEndpoint = parsedJson.chosenEndpoint;
    if (typeof possiblyChosenEndpoint === "string") {
      config.chosenEndpoint = possiblyChosenEndpoint;
    }

    const possiblyTickerSymbol = parsedJson.tickerSymbol;
    if (typeof possiblyTickerSymbol === "string") {
      if (isValidTickerSymbol(possiblyTickerSymbol)) {
        config.tickerSymbol = possiblyTickerSymbol;
      } else {
        console.log(
          yellow(
            `tickerSymbol field inside smartcraft.config.json is invalid (${possiblyTickerSymbol}). A valid one is 1-6 uppercase letters.`,
          ),
        );
      }
    }
  } catch (e) {
    console.log(
      "Welcome! An existing config.json seems to be corrupted. It can be re-created interactively here. Alternatively, use Ctrl+C to exit.",
    );
  }
} catch (e) {
  console.log(
    "Welcome! An existing config.json was not found. It can be created interactively using this tool.",
  );
}

if (interactiveApiKeyConfig || config.apiKey === null) {
  await promptApiKey();
} else {
  let testResult = await testNetworkAndCredentials(config.apiKey);
  if (!testResult) {
    await promptApiKey();
  }
}

async function promptOrg(whoami: Whoami): Promise<string> {
  while (true) {
    if (whoami.directorOf.length === 0) {
      fatalLog(
        `You are not a director of any organizations :(.\nYou can create one by following the instructions on GitHub.`,
      );
    } else if (whoami.directorOf.length === 1) {
      console.log(
        `You are a director of only one organization. Automatically choosing ${
          whoami.directorOf[0]
        }`,
      );
      return whoami.directorOf[0];
    } else {
      console.log(
        blue(
          `Choose which organization to interact with. You are a director of:\n  ${
            whoami.directorOf.join("\n  ")
          }`,
        ),
      );
      const chosenOrg =
        (await prompt("\nEnter your organization ticker symbol"))
          .trim().toUpperCase();
      console.log();

      if (chosenOrg.match(/^[A-Z]{1,6}$/) === null) {
        console.log(
          red(
            `Ticker symbols are 1 to 6 letters. Received invalid input "${chosenOrg}"`,
          ),
        );
      } else {
        const index = whoami.directorOf.indexOf(chosenOrg);
        if (index !== -1) {
          return chosenOrg;
        } else {
          console.log(
            red(
              `Got input "${chosenOrg}" which is not in the list of organizations.`,
            ),
          );
        }
      }
    }
  }
}
export async function exists(filePath: string): Promise<boolean> {
  try {
    await Deno.lstat(filePath);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return false;
    }

    throw err;
  }
}

type APIResponseUpload = {
  error: string;
} | {
  status: "compileError" | "testError" | "success";
  message: string;
};
if (
  networkStatus && "generalUsername" in networkStatus &&
  config.chosenEndpoint !== null && config.apiKey !== null
) {
  // Thanks to promptApiKey(), we are now basically guaranteed to have a valid API key and online server
  const whoami = networkStatus;

  // If ticker symbol was not chosen, or if the saved thing is no longer accurate
  if (
    !config.tickerSymbol ||
    whoami.directorOf.indexOf(config.tickerSymbol) === -1
  ) {
    const chosenOrg = await promptOrg(whoami);

    if (config.tickerSymbol !== chosenOrg) {
      config.tickerSymbol = chosenOrg;
      saveConfig();
    } else {
      console.log("Not saving config");
    }
  }

  // Be fully confident that tickerSymbol is safe, to prevent any possible security vulnerabilities
  if (config.tickerSymbol.match(/^[A-Z]{1,6}$/) === null) {
    fatalLog(
      `Uh oh, tickerSymbol is invalid: ${config.tickerSymbol}. This is a bug in the tool.`,
    );
  }
  console.log(
    green(
      `Organization with ticker symbol ${config.tickerSymbol} has been chosen.\nTo change this, edit the smartcraft.config.json file.`,
    ),
  );

  const contractPath = `contracts/${config.tickerSymbol}.ts`;
  let contractCodeFile = "";
  try {
    contractCodeFile = await readFile(createURL(contractPath));
    if (contractCodeFile.length < 1) {
      fatalLog(
        `${contractPath} is empty. Try copying contracts/EXAMPLE.ts to ${contractPath}`,
      );
    }
    // "Linter"
    if (!contractCodeFile.indexOf("new SCWorkerRuntime")) {
      fatalLog(
        `${contractPath} needs to use SCWorkerRuntime. See the bottom of contracts/EXAMPLE.ts`,
      );
    }
  } catch (e) {
    fatalLog(
      `Missing contract file at ${contractPath}. Try copying contracts/EXAMPLE.ts to ${contractPath}`,
    );
  }

  console.log(
    `Alrighty! Now uploading contract for ${config.tickerSymbol}...\n(may take a few seconds)...`,
  );
  try {
    const uploadResponse: APIResponseUpload = await uploadFetch(
      config.chosenEndpoint,
      config.apiKey,
      config.tickerSymbol,
      contractCodeFile,
    ) as APIResponseUpload;
    if ("error" in uploadResponse) {
      console.log(red(`Non-code related error when uploading smart contract.`));
      fatalLog(uploadResponse.error);
    } else {
      if (uploadResponse.status === "compileError") {
        console.log(bgRed("  Compile Error  "));
        console.log(uploadResponse.message);
      } else if (uploadResponse.status === "testError") {
        console.log(bgRed("  Test Error  "));
        console.log(uploadResponse.message);
      } else if (uploadResponse.status === "success") {
        console.log(bgGreen("  Great Success!  "));
        console.log(uploadResponse.message);
      } else {
        console.log(uploadResponse);
        reportBroken(
          "upload tool response decoder",
          "Unknown uploadResponse status.",
        );
      }
      Deno.exit();
    }
  } catch (e) {
    fatalLog(e.toString());
  }
} else {
  reportBroken(
    "upload tool",
    `Even after full setup, config was not fully defined.\nnetworkStatus = ${
      JSON.stringify(networkStatus, null, 2)
    }\nconfig = ${JSON.stringify(config, null, 2)}`,
  );
}
// const a = await prompt("Hello")
// console.log(a)
