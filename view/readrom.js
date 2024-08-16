/**
 * SPDX-FileCopyrightText: 2022 Zeal 8-bit Computer <contact@zeal8bit.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const params = parseQueryParams(window.location.search);

function load_bin(file){
    let reader = new FileReader();
    const isos = $("#os").prop("checked");
    reader.addEventListener('load', function(e) {
        let binary = e.target.result;
        if (isos) {
            zealcom.rom.loadFile(binary);
            $("#binready").addClass("ready");
        } else {
            const addr = $("#address").val();
            const result = parseInt(addr, 16);
            zealcom.ram.loadFile(result, binary);
        }
    });
    if (typeof file !== "undefined") {
        reader.readAsBinaryString(file);
    }
}

$("#read-button").on('click', function() {
    /* If a dump/map file was provided, try to load it */
    let fdump = $("#file-dump")[0].files[0];
    if (typeof fdump !== "undefined") {
        let rdump = new FileReader();
        rdump.addEventListener('load', (e) => {
            const success = disassembler.loadSymbols(e.target.result);
            if (success) {
                /* symbols are ready! */
                $("#symready").addClass("ready");
            }
        });
        rdump.readAsText(fdump);
    }

    /* Read the binary executable */
    let file = $("#file-input")[0].files[0];
    load_bin(file);

    /* Read the EEPROM image */
    file = $("#eeprom-bin")[0].files[0];
    let eepromr = new FileReader();
    eepromr.addEventListener('load', function(e) {
        let binary = e.target.result;
        zealcom.eeprom.loadFile(binary);
        $("#eepromready").addClass("ready");
    });
    if (typeof file !== "undefined") {
        eepromr.readAsBinaryString(file);
    }

    /* Read the CompactFlash image */
    file = $("#cf-bin")[0].files[0];
    let cfr = new FileReader();
    cfr.addEventListener('load', function(e) {
        let binary = e.target.result;
        zealcom.compactflash.loadFile(binary);
        $("#cfready").addClass("ready");
    });
    if (typeof file !== "undefined") {
        cfr.readAsBinaryString(file);
    }
});

$("#romadvanced a").click(() => {
    $("#romfile").toggle(500);
});

function switchToAdvancedMode(error) {
    popout.error("Could not fetch remote data, switched to advanced mode");
    console.error(error);
    /* Hide advanced link option and ROMs list */
    $("#romload").hide(250, function() {
        /* Show file uploaders */
        $("#romfile").show(250);
    });
}

/*
    Only for debug, I don't hold all of the copyright of the
    prebuild images in this index and I'm not sure they are safe     --Jason
*/
// const prebuilt_json_url = "https://jasonmo1.github.io/ZOS-Index-demo/index.json"

/* Process the index JSON object that contains all the ROMs available */
function processIndex(index) {
    const to_option = (entry,selected=false) => {
        const attrs = {
            value: entry.urls,
            hash: entry.hash,
        };

        if(selected) {
            attrs.selected = true;
        }
        const attributes = Object.keys(attrs).reduce((acc,key) => {
            acc += `${key}`;
            if(!['selected', 'disabled'].includes(key) && attrs[key]) {
                acc += `="${attrs[key]}" `;
            }
            return acc;
        }, '');

        return `<option ${attributes}>${entry.name}</option>`;
    };

    /* Generate an HTML option out of each entry */
    const latest  = to_option(index.latest, index.latest.urls == params.r || params.r == 'latest');
    const nightly = index.nightly.reverse().map((entry, index) => {
        if((params.r == entry.urls) || (params.r == 'nightly' && index == 0)) {
            return to_option(entry, true);
        }
        return to_option(entry, false);
    });
    const stable  = index.stable.map((entry) => to_option(entry, false));

    let all_options = [
        `<option value="">Choose an image...</option>`,
    ];
    if(index.latest) {
        all_options.push(`<optgroup label="--- Latest ---" data-type="latest">` + latest + `</optgroup>`);
    }
    if(index.nightly) {
        all_options.push(`<optgroup label="--- Nightly ---"  data-type="nightly">` + nightly.join("") + `</optgroup>`);
    }
    if(index.stable) {
        all_options.push(`<optgroup label="--- Stable ---"  data-type="stable">` + stable.join("") + `</optgroup>`);
    }


    $("#romchoice").html(all_options.join("\n"));
    $("#romchoice").on("change", switchRom);
    if(params.r && $("#romchoice").find(":selected").length ) {
        $('#romchoice').trigger('change');
    }
}

function resetRom() {
    rom_chosen = false;
    /* Reset all the file inputs */
    $("#romfile [type=file]").val("");
    /* Remove the ticks from the ready list */
    $(".status").removeClass("ready");
    $("#romchoice").each(function(){
        $(this).find("option").eq(0).prop("selected",true)
    });
}

var rom_chosen = false;
/**
 * Add a listener to the romchoice list, load the ROM when selected
 */
async function switchRom() {
    if (rom_chosen !== false) {
        let cover = window.confirm("This will cover the current image, Confirm?");
        if (cover == false) {
            $("#romchoice").val(rom_chosen)
            return;
        }
        else {
            zealcom.restart(reset_rom_selected=false);
        }
    }
    /* Get the URL of the current choice */
    rom_chosen = $(this).val();
    let compare = false;
    if(params.r == 'latest') {
        compare = $('#romchoice optgroup[data-type=latest] option:first-child').val();
    }
    if(params.r == 'nightly') {
        compare = $('#romchoice optgroup[data-type=nightly] option:first-child').val();
    }

    /* Get the hash for the current binary */
    let hash = $(`#romchoice option[value="${rom_chosen}"]`).attr("hash");

    if (!rom_chosen) {
        return;
    }

    $("#loading_img").visible();

    try {
        let data = await readBlobFromUrl(rom_chosen);
        let hashcomp = await filehash(data, hash);
        if (hashcomp == true) {
            load_bin(data);
        }
        $("#loading_img").invisible();
        if(rom_chosen !== compare) {
            window.history.pushState({}, undefined, `?r=${rom_chosen}`);
        }
        zealcom.cont();
    }
    catch (error) {
        switchToAdvancedMode(error);
    }
};

jQuery(() => {
    if (params.advanced) {
        /**
         * Manage the "advanced" link that shows all the files uploader
         * If the URL has "advanced" parameters, show these uploaders directly
         */
        $("#romload").hide();
        $("#romfile").show();
    } else {
        /**
         * Manage the pre-built ROMs list. Available ROMs will be fetched from a remote JSON file that contains
         * names and links to all of the available ROMs, the first one will always be the default.
         */
        const prebuilt_json_url_host = "https://zeal8bit.com";
        const prebuilt_json_url_path = "/roms/index.json";
        /* Fetch the remote JSON file, and pass the content to the previous function */
        fetch(prebuilt_json_url_host + prebuilt_json_url_path)
            .then(response => response.json())
            .then(response => processIndex(response))
            .catch(() => {
                fetch(prebuilt_json_url_path)
                .then(response => response.json())
                .then(response => processIndex(response))
                .catch(switchToAdvancedMode);
            });
    }
});