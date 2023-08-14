/**
 * SPDX-FileCopyrightText: 2022 Zeal 8-bit Computer <contact@zeal8bit.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Before initializing the components/peripherals, create the callback set.
 * Indeed, one of them may need to register a callback on init. */

 /* Set of T-states callbacks Object: { tstates, callback, period }
 * In theory, a Binary Heap (min heap) would be better. In practice,
 * We won't have a lot on entries in here. At most 4.
 */

var zealcom = new Zeal8bitComputer();
const disassembler = new Disassembler();

/* Memdump related */
const byte_per_line = 0x20;

function isPrintable(byteCode) {
    return byteCode >= 32 && byteCode <= 126;
}

function dumpRamContent(virtaddr, physaddr, lines) {
    var result = "";
    for (var i = 0; i < lines * byte_per_line; i += byte_per_line) {
        let ascii = [];

        result += '<section class="memline">' +
                    '<section class="memaddr">' +
                    hex(virtaddr + i, true) + " (" + hex(physaddr + i, true, 6) + ")" +
                    '</section>' +
                  '<section class="membytes">';
        for (var j = 0; j < byte_per_line; j++) {
            const virt = virtaddr + i + j
            var byte = zealcom.mem_read(virt);
            if (isPrintable(byte)) {
                ascii.push(String.fromCharCode(byte));
            } else {
                ascii.push('.');
            }
            str = byte.toString(16);
            if (str.length == 1)
                str = "0" + str;
            result += '<div data-byte="' + byte + '" data-addr="' + virt + '">' + str + '</div>';
        }
        result += '</section>';
        /* Generate the ASCII result */
        ascii = ascii.map(c => c == ' ' ? '&nbsp;' : c);
        ascii = ascii.map(c => '<div class="asciichar">' + c + '</div>');
        result += '<section class="asciichars">' + ascii.join('') + '</section>';
        result += '</section>';
    }
    return result;
}

function setASMView() {

    /* Get the PC, which is a virtual address */
    const pc = zealcom.registers != null ? (zealcom.registers.pc) : 0;

    /* Set the number of instructions we need to disassemble and show */
    const instructions = 20;
    /* The average number of bytes per instruction is 2 or 3 */
    const bytes = instructions * 3;

    /* Read "bytes" bytes from the Z80 virtual memory */
    var memory = []
    /* Add 4 bytes so that if the last instruction is a 4 byte instruction, we won't go out of
     * bounds when disassembling */
    for (var i = 0; i < bytes + 4; i++) {
        memory.push(zealcom.mem_read(pc + i));
    }

    /* Disassemble this part of the memory */
    const instr_arr = disassembler.disassemble(memory, bytes, pc);

    const result = instr_arr.map(entry => {
        var cssclass = (entry.instruction && (entry.addr == pc)) ? "activeline" : "";
        var text = "";

        if (entry.label) {
            cssclass += " labelline";
            text = entry.label
        } else {
            cssclass += " dumpline";
            text = entry.instruction;
        }

        /* Check if the current address has a breakpoint */
        const breakpoint = getBreakpoint(entry.addr);
        const brk = breakpoint == null ? "" : "brk";

        return `<div data-addr="${entry.addr}" class="${cssclass} ${brk}">${text}</div>`;
    });

    $("#memdump").html(result);
}

function setRAMView(virtaddr, size) {
    // TODO: Add the addr to a watchlist that will be updates after a breakpoint is reached
    const physaddr = zealcom.mmu.get_ext_addr(virtaddr);
    const dumptxt = dumpRamContent(virtaddr, physaddr, size / byte_per_line);
    $("#dumpcontent").html(dumptxt);
}

function setMMUView() {
    /* MMU panel */
    var mmuresult = "";
    for (var i = 0 ; i < 4; i++) {
        const ext_addr = mmu.get_ext_addr(16*1024*i);
        mmuresult += "<section>Page " + i + ": " + ext_addr.toString(16) + "</section>";
    }
    $("#dumpcontent").html(mmuresult);
}

function updateAndShowRAM () {
    /* Get ASM updates */
    setASMView();
    //setMMUView();
    //$("#memdump").toggleClass("hide");
}

function updateRegistersHTML() {
    let reg = zealcom.registers;
    $("#rega").text(hex8(reg.a));
    $("#regb").text(hex8(reg.b));
    $("#regc").text(hex8(reg.c));
    $("#regd").text(hex8(reg.d));
    $("#rege").text(hex8(reg.e));
    $("#regh").text(hex8(reg.h));
    $("#regl").text(hex8(reg.l));
    $("#regix").text(hex(reg.ix));
    $("#regiy").text(hex(reg.iy));
    $("#regbc").text(hex16(reg.b, reg.c));
    $("#regde").text(hex16(reg.d, reg.e));
    $("#reghl").text(hex16(reg.h, reg.l));
    $("#regpc").text(hex(reg.pc));
    $("#regsp").text(hex(reg.sp));
    /* Special treatment for the flags */
    var flags = (reg.flags.S == 1 ? "S" : "") +
                (reg.flags.Z == 1 ? "Z" : "") +
                (reg.flags.Y == 1 ? "Y" : "") +
                (reg.flags.H == 1 ? "H" : "") +
                (reg.flags.X == 1 ? "X" : "") +
                (reg.flags.P == 1 ? "P" : "") +
                (reg.flags.N == 1 ? "N" : "") +
                (reg.flags.C == 1 ? "C" : "");

    $("#flags").text(flags);

    /* Toggle RAM */
    updateAndShowRAM();
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
});

$("#screen").on("keydown", function(e) {
    const handled = zealcom.keyboard.key_pressed(e.keyCode);

    if (handled) {
        e.preventDefault();
    }
});

$("#screen").on("keyup", function(e) {
    const handled = zealcom.keyboard.key_released(e.keyCode);

    if (handled) {
        e.preventDefault();
    }
});

/**
 * Add listeners on the add breakpoint field
 */

$("#bpaddr").on('keydown', function(event) {
    if (event.key === "Enter") {
        $("#addbp").click();
    }
});

$("#addbp").on("click", function (){
    const written = $("#bpaddr").val();
    /* Empty the text field */
    $("#bpaddr").val("");
    if (written.length < 1) return;
    var result = parseInt(written, 16);
    if (isNaN(result)) {
        /* Could be a label, let's check this */
        const addr = disassembler.labelAddress(written);
        if (addr === null) {
            return;
        }
        result = addr;
    }
    /* Only add the breakpoint if not in the list */
    addBreakpoint(result);
});

var breakpoints = [];

function addBreakpoint(addr) {
    if (!breakpoints.includes(addr) && addr <= 0xFFFF) {
        breakpoints.push({ address: addr, enabled: true });
        $("#bps").append(`<li data-addr="${addr}">${hex(addr)}</li>`);
        /* If the line is currently being disassembled, mark it as a breakpoint */
        $(`.dumpline[data-addr='${addr}']`).addClass("brk");
    }
}

function getBreakpoint(addr) {
    /* Find the breakpoint object in the breakpoint list */
    const bkrobj = breakpoints.find(element => element.address == addr);
    return (bkrobj != undefined) ? bkrobj : null;
}

function toggleBreakpoint(brkaddr) {
    $(`#bps li[data-addr='${brkaddr}']`).toggleClass("disabled");
    $(`.dumpline[data-addr='${brkaddr}']`).toggleClass("brk");

    /* Find the breakpoint object in the breakpoint list */
    const bkrobj = breakpoints.find(element => element.address == brkaddr);
    /* Toggle enabled field in the breakpoint */
    if (bkrobj != undefined)
        bkrobj.enabled ^= true;
}

/**
 * Add a listener on each disassembled line. On click, we can toggle the breakpoints.
 * Because these dumplines are geenrated at runtime, we must install the listener on the
 * parent element.
 */
$("#memdump").on("click", ".dumpline", function() {
    const brkaddr = $(this).data("addr");
    /* If the address is not in the breakpoint list, add it */
    const brk = getBreakpoint(brkaddr);
    if (brk == null) {
        addBreakpoint(brkaddr);
    } else {
        toggleBreakpoint(brkaddr);
    }
});

/**
 * @brief The following events must NOT be linked to zealcom object methods
 * because that object will change after a reset. As such, these method must be
 * evaluated and called lazily only when needed.
 */
$("#step").on("click",     () => zealcom.step());
$("#stop").on("click",     () => zealcom.stop());
$("#stepover").on("click", () => zealcom.step_over());
$("#continue").on("click", () => zealcom.cont());
$("#restart").on("click",  () => zealcom.restart());

$("#bps").on("click", "li", function() {
    /* Get the breakpoint address */
    const bkpaddr = $(this).data("addr");
    toggleBreakpoint(bkpaddr);
});

$("#dumpnow").on("click", function() {
    const virtaddr = parseInt($("#dumpaddr").val(), 16);
    const size = parseInt($("#dumpsize").val());
    setRAMView(virtaddr, size);
});

var mousepressed = false;

$(".membytes").on("mousedown", "div", function() {
    mousepressed = true;
    $(".membytes .selected").removeClass("selected");
    $(this).toggleClass("selected");
});
$(".membytes").on("mouseup", "div", function() {
    mousepressed = false;
});

$(".membytes").on("mouseenter", "div", function() {
    if (mousepressed) {
        $(this).toggleClass("selected");
    }
});

$(".tab").on("click", function(){
    const index = $(this).index();
    $(".tab").removeClass("active");
    $(".bottompanel .panel").addClass("hidden");
    $(".bottompanel .panel").eq(index).removeClass("hidden");
    $(this).addClass("active");
});

$("#clearterm").on("click", function() {
    terminal.reset();
});

$("#baudrate").on("change", function() {
    const baudrate = $(this).val();
    uart.set_baudrate(baudrate);
});

/* It is possible to send files as raw binary data on the UART, place
 * a listener on the send button for that */
$("#uart-file-send").on("click", function() {
    /* Read the binary executable */
    let file = $("#uart-file")[0].files[0];
    let reader = new FileReader();
    reader.addEventListener('load', function(e) {
        let binary = e.target.result;
        zealcom.uart.send_binary_array(binary);
    });
    if (typeof file !== "undefined") {
        reader.readAsBinaryString(file);
    }
});

document.addEventListener('keydown', function(event) {
    const binding = {'F9': zealcom.cont, 'F10': zealcom.step, 'F11': zealcom.step_over};
    if (binding[event.key]) {
        binding[event.key]();
    }
});


$(".regaddr").click(function() {
    const virtaddr = parseInt($(this).text(), 16);
    if (virtaddr || virtaddr == 0) {
        const size = 256;
        setRAMView(virtaddr, size);
        $("#memory-tab").click();
    }
});


function setClassToASCIIChar(object, classname, add) {
    const index = object.index();
    /* Add/Remove classname to the ascii cahracter corresponding to the current address */
    const asciiline = object.parent().next();
    /* ascii line is made out of divs, get the children */
    if (add) {
        asciiline.children().eq(index).addClass(classname);
    } else {
        asciiline.children().eq(index).removeClass(classname);
    }
}

function setClassToMemoryByte(object, classname, add) {
    const index = object.index();
    /* Add/Remove classname to the ascii cahracter corresponding to the current address */
    const memoryline = object.parent().prev();
    /* Memory bytes is made out of divs, get the children */
    const child = memoryline.children().eq(index);
    if (add) {
        child.addClass(classname);
        setMemoryByteAddress(child);
    } else {
        child.removeClass(classname);
    }
}

function setMemoryByteAddress(object) {
    const str = parseInt(object.attr("data-addr"));
    const val = hex(str, true, 4);
    $("#current_memaddr").text(val);
}

$("#dumpcontent").on("mouseleave", ".membytes div", function() {
    setClassToASCIIChar($(this), "activefield", false);
});

$("#dumpcontent").on("mouseenter", ".membytes div", function() {
    setClassToASCIIChar($(this), "activefield", true);
    setMemoryByteAddress($(this));
});

$("#dumpcontent").on("mouseleave", ".asciichars div", function() {
    setClassToMemoryByte($(this), "activefield", false);
});

$("#dumpcontent").on("mouseenter", ".asciichars div", function() {
    setClassToMemoryByte($(this), "activefield", true);
});

$("#romadvanced").click(function () { $("#romfile").toggle(500); });
