/**
 * SPDX-FileCopyrightText: 2024 Zeal 8-bit Computer <contact@zeal8bit.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

(() => {
  const haveEvents = "GamepadEvent" in window;
  const haveWebkitEvents = "WebKitGamepadEvent" in window;

  const Buttons = {
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
    Unused1: 13,
    Unused2: 12,
    Unused3: 14,
    Unused4: 15,
  }

  if (haveEvents) {
    window.addEventListener("gamepadconnected", gamepadConnect);
    window.addEventListener("gamepaddisconnected", gamepadDisconnect);
  } else if (haveWebkitEvents) {
    window.addEventListener("webkitgamepadconnected", gamepadConnect);
    window.addEventListener("webkitgamepaddisconnected", gamepadDisconnect);
  } else {
    $("#gamepadview-start").text(
      "GamePad API is not supported in this browser, please use Chrome"
    );
  }

  let active = false;
  $("#gamepad").on("active", () => {
    active = true;
    requestAnimationFrame(gamepadTabUpdate);
  });

  $("#gamepad").on("inactive", () => {
    active = false;
  });

  const gamePads = {};
  const mappings = {};
  const userPort = {};

  function attachToUserPort(gamepad) {
    const { index } = gamepad;
    console.log('attach', index, gamepad.id);
    const controller = new SNESAdapter(zealcom, zealcom.pio);
    controller.attach(index);
    userPort[index] = controller;
    updateGamepadMap(gamepad);
  }

  function detachFromUserPort(gamepad) {
    const { index } = gamepad;
    console.log('detach', index, gamepad.id);
    if(userPort && userPort[index]) {
      userPort[index].detatch();
      delete userPort[index];
      console.log('userPort', userPort);
    }
  }

  function updateGamepadMap(gamepad) {
    const { index } = gamepad;
    const map = mappings[gamepad.id] ?? Buttons;
    Object.assign(userPort[index].buttons, map);
    console.log(userPort[index].buttons);
  }

  function makeControllerContainer(gamepad) {
    const { index } = gamepad;
    const id = `controller${index}`;

    // get stored or create default mapping
    mappings[gamepad.id] = (() => {
      const map = JSON.parse(localStorage.getItem(gamepad.id) ?? 'null');
      return map ?? Object.assign({}, Buttons);
    })();

    // div.controller
    const details = document.createElement("div");
    $(details).attr({
      id,
    }).addClass('controller');

    // div.toolbar
    const toolbar = document.createElement("div");
    $(toolbar).attr({
      id,
    }).addClass('toolbar');
    $(details).append(toolbar);

    // button attach()
    const attachButton = document.createElement("button");
    $(attachButton).text('Attach').on('click', () => {
      attachToUserPort(gamepad);
      $(attachButton).attr('disabled', true);
    });
    $(toolbar).append(attachButton);

    // button detach()
    const detatchButton = document.createElement("button");
    $(detatchButton).text('Detach').on('click', () => {
      detachFromUserPort(gamepad);
      $(attachButton).removeAttr('disabled');
    });
    $(toolbar).append(detatchButton);

    // button saveMap()
    const saveMapButton = document.createElement("button");
    $(saveMapButton).text('Save Map').on('click', () => {
      console.log('saveMap', index, gamepad.id);
      if(mappings[gamepad.id]) {
        const map = mappings[gamepad.id];
        console.log('saveMap', gamepad.id, map);
        localStorage.setItem(gamepad.id, JSON.stringify(map));
        $(saveMapButton).removeClass('alert');
      }
    });
    $(toolbar).append(saveMapButton);

    // h1
    const title = document.createElement("h1");
    $(title).text(gamepad.id);
    $(details).append(title);

    // div.buttons
    const buttons = document.createElement("div");
    buttons.className = "buttons";
    for (let i = 0; i < gamepad.buttons.length; i++) {

      const select = document.createElement('select');
      $(select).append($('<option value="-1">Ignore</option>'));
      for(let name in Buttons) {
        const option = document.createElement('option');
        if(mappings[gamepad.id][name] == i) {
          $(option).attr('selected', true);
        }
        $(option).attr({
          value: Buttons[name],
        }).text(name);
        $(select).append(option);
      }
      $(buttons).append(select);
      $(select).addClass('button').on('change', (e) => {
        const $this = $(e.currentTarget);
        console.log('mapping', i, $this.val());
        $(saveMapButton).addClass('alert');
        if(mappings[gamepad.id]) {
          const label = $('option:selected', $this).text();
          mappings[gamepad.id][label] = i;
        }
        console.log('mapping', mappings[gamepad.id]);
        updateGamepadMap(gamepad);
      });
    }
    $(details).append(buttons);

    // div.axes
    const axes = document.createElement("div");
    axes.className = "axes";
    for (i = 0; i < gamepad.axes.length; i++) {
      e = document.createElement("meter");
      e.className = "axis";
      $(e).attr({
        min: -1,
        max: 1,
        value: 0,
      });
      e.innerHTML = i;
      $(axes).append(e);
    }
    $(details).append(axes);

    // Credit: https://commons.wikimedia.org/wiki/File:SNES_controller.svg
    const svg = document.createElement('div');
    $(svg).attr({
      id: `${id}-svg`
    }).addClass('svg').load('/imgs/snes-controller.svg');

    // $(svg).attr({
    //   data: '/imgs/snes-controller.svg',
    //   type: 'image/svg+xml',
    // });
    $(details).append(svg);

    return details;
  }

  function gamepadConnect(e) {
    const { gamepad } = e;
    const { index } = gamepad;
    gamePads[index] = gamepad;
    const d = makeControllerContainer(gamepad);
    $("#gamepadview-start").css({ display: "none" });
    $("#gamepadview").removeClass("empty").append(d);
  }

  function gamepadDisconnect(e) {
    const { gamepad } = e;
    const d = document.getElementById("controller" + gamepad.index);
    document.body.removeChild(d);
    delete gamePads[gamepad.index];
  }

  function gamepadTabUpdate() {
    const gamePads = navigator.getGamepads() ?? [];
    for (j = 0; j < gamePads.length; j++) {
      const gamepad = gamePads[j];
      if(!gamepad) continue;
      const d = document.getElementById("controller" + j);
      if(!d) continue;

      const buttons = d.getElementsByClassName("button");
      for (let i = 0; i < gamepad.buttons.length; i++) {
        const b = buttons[i];
        let val = gamepad.buttons[i];
        let pressed = val == 1.0;
        let touched = false;
        if (typeof val == "object") {
          pressed = val.pressed;
          if ("touched" in val) {
            touched = val.touched;
          }
          val = val.value;
        }
        const pct = Math.round(val * 100) + "%";
        b.style.backgroundSize = pct + " " + pct;
        b.className = "button";
        if (pressed) {
          b.className += " pressed";
        }
        if (touched) {
          b.className += " touched";
        }

        if(mappings[gamepad.id]) {
          const map = mappings[gamepad.id];
          // lookup mapping
          for(button in map) {
            if(map[button] == i) {
              // console.log('found map', button, map[buttons]);
              const $svg = $(`#controller${j}-svg svg`);
              const $svgButton = $svg.find(`.svg-button-${button.toLowerCase()}`);
              if(pressed || touched) {
                $svgButton.addClass('pressed');
              } else {
                $svgButton.removeClass('pressed');
              }
            }
          }
        }
      }

      const axes = d.getElementsByClassName("axis");
      for (let i = 0; i < gamepad.axes.length; i++) {
        const a = axes[i];
        a.innerHTML = i + ": " + gamepad.axes[i].toFixed(4);
        a.setAttribute("value", gamepad.axes[i]);
      }
    }
    if(active) requestAnimationFrame(gamepadTabUpdate);
  }
})();
