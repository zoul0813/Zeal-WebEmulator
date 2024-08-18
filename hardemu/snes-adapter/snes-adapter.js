/**
 * SPDX-FileCopyrightText: 2024 Zeal 8-bit Computer <contact@zeal8bit.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

function SNESAdapter(Zeal, PIO, dataPin = 0) {
  const zeal = Zeal;
  const pio = PIO;

  const AXIS_THRESHOLD = 0.75;

  const IO_DATA_1   = 0;
  const IO_DATA_2   = 1;
  const IO_LATCH    = 2;
  const IO_CLOCK    = 3;
  let controllerIndex = false;
  const buttons = {
    B: 0,
    Y: 1,
    Select: 2,
    Start: 3,
    Up: 4,
    Down: 5,
    Left: 6,
    Right: 7,
    A: 8,
    X: 9,
    L: 10,
    R: 11,
    Unused1: 12,
    Unused2: 13,
    Unused3: 14,
    Unused4: 15,
  };
  let bits = Array.apply(null, Array(16)).map(() => 0);
  let bitCounter = 0;

  function gamepadScan() {
    const gamepads = navigator.getGamepads() ?? [];
    for (let i = 0; i < gamepads.length; i++) {
      if(gamepads[i].index == controllerIndex) {
        return gamepads[i];
      }
    }
  }

  const latch = (pin, bit) => {
    const gamepad = gamepadScan();
    bitCounter = 0;

    // set buttons
    for(let i = 0; i < gamepad.buttons.length; i++) {
      switch(i) {
        case buttons.B: bits[0] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Y: bits[1] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Select: bits[2] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Start: bits[3] = gamepad.buttons[i].pressed ? 1 : 0; break;
        // case buttons.Up: bits[buttons.Up] = gamepad.buttons[i].pressed ? 1 : 0; break;
        // case buttons.Down: bits[buttons.Down] = gamepad.buttons[i].pressed ? 1 : 0; break;
        // case buttons.Left: bits[buttons.Left] = gamepad.buttons[i].pressed ? 1 : 0; break;
        // case buttons.Right: bits[buttons.Right] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.A: bits[8] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.X: bits[9] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.L: bits[10] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.R: bits[11] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Unused1: bits[12] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Unused2: bits[13] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Unused3: bits[14] = gamepad.buttons[i].pressed ? 1 : 0; break;
        case buttons.Unused4: bits[15] = gamepad.buttons[i].pressed ? 1 : 0; break;
      }
    }
    // set axes
    // for(let i = 0; i < gamepad.axes.length; i++) {
    //   switch(i) {
    //     case 0: {
    //       bits[buttons.Up] = gamepad.axes[i] > AXIS_THRESHOLD ? 1 : 0;
    //       bits[buttons.Down] = gamepad.axes[i] < -AXIS_THRESHOLD ? 1 : 0;
    //     } break;
    //     case 1: {
    //       bits[buttons.Up] = gamepad.axes[i] > AXIS_THRESHOLD ? 1 : 0;
    //       bits[buttons.Left] = gamepad.axes[i] < -AXIS_THRESHOLD ? 1 : 0;
    //     } break;
    //   }
    // }

    // set IO_DATA to first button
    pio.pio_set_a_pin(dataPin, bits[bitCounter]);
  };

  const clock = (pin, bit) => {
    bitCounter++;
    pio.pio_set_a_pin(dataPin, bits[bitCounter]);
  };

  const attach = (index) => {
    console.log('attaching gamepad', index);
    controllerIndex = index;
    pio.pio_listen_a_pin_change(IO_LATCH, 1, latch);
    pio.pio_listen_a_pin_change(IO_CLOCK, 1, clock);
    // pio.pio_listen_a_pin(dataPin, data);
  };

  const detatch = () => {
    console.log('detaching gamepad', controllerIndex);
    pio.pio_unlisten_a_pin_change(IO_LATCH);
    pio.pio_unlisten_a_pin_change(IO_CLOCK);
  };

  return {
    attach,
    detatch,
    buttons,
  }
}