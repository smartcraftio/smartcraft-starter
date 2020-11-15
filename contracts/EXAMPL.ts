import { ContractBase } from "../scapi/ContractBase.ts";
import { SCWorkerRuntime } from "../scapi/SCWorkerRuntime.ts";
import * as scio from "../scapi/scioTypes.ts";
// Do not change the imports. They are all necessary.

/**
 * CHANGE ME! Provide some good typings for your state.
 */
interface ContractState {
  foobar: number;
}

class Contract extends ContractBase {
  // Set an initial state to extend, in case there was no initial state saved
  state: ContractState = {
    foobar: 0,
  };

  constructor(init: scio.ContractInitialization) {
    super(init);
    Object.assign(this.state, init.state);
  }

  publicGetState(): Record<string, any> {
    // Return your this.state if you want to publicize everything
    // return this.state

    return {};
  }

  onMinecraftPlayerJoinEvent(event: scio.MinecraftPlayerJoinEvent) {
    this.api.broadcast(
      `Welcome back, ${event.player.uniqueId}. Foobar is ${this.state.foobar}`,
    );
    this.state.foobar += 1;
  }

  _test(): void {}
}

new SCWorkerRuntime(Contract, import.meta); // This line is required
