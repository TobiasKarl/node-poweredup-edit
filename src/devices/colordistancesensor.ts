import { Device } from "./device";

import { IDeviceInterface } from "../interfaces";

import * as Consts from "../consts";

/**
 * @class ColorDistanceSensor
 * @extends Device
 */
export class ColorDistanceSensor extends Device {

    private _pfToggleBit = 0;

    constructor (hub: IDeviceInterface, portId: number) {
        super(hub, portId, ModeMap, Consts.DeviceType.COLOR_DISTANCE_SENSOR);
    }

    public receive (message: Buffer) {
        const mode = this._mode;

        switch (mode) {
            case Mode.COLOR:
                if (message[this.isWeDo2SmartHub ? 2 : 4] <= 10) {
                    const color = message[this.isWeDo2SmartHub ? 2 : 4];

                    /**
                     * Emits when a color sensor is activated.
                     * @event ColorDistanceSensor#color
                     * @type {object}
                     * @param {Color} color
                     */
                    this.notify("color", { color });
                }
                break;

            case Mode.DISTANCE:
                if (this.isWeDo2SmartHub) {
                    break;
                }
                if (message[4] <= 10) {
                    const distance = Math.floor(message[4] * 25.4) - 20;

                    /**
                     * Emits when a distance sensor is activated.
                     * @event ColorDistanceSensor#distance
                     * @type {object}
                     * @param {number} distance Distance, in millimeters.
                     */
                    this.notify("distance", { distance });
                }
                break;

            case Mode.COLOR_AND_DISTANCE:
                if (this.isWeDo2SmartHub) {
                    break;
                }

                let distance = message[5];
                const partial = message[7];

                if (partial > 0) {
                    distance += 1.0 / partial;
                }

                distance = Math.floor(distance * 25.4) - 20;

                /**
                 * A combined color and distance event, emits when the sensor is activated.
                 * @event ColorDistanceSensor#colorAndDistance
                 * @type {object}
                 * @param {Color} color
                 * @param {number} distance Distance, in millimeters.
                 */
                if (message[4] <= 10) {
                    const color = message[4];
                    this.notify("colorAndDistance", { color, distance });
                }
                break;

        }
    }


    /**
     * Switches the IR receiver into extended channel mode. After setting this, use channels 5-8 instead of 1-4 for this receiver.
     *
     * NOTE: Calling this with channel 5-8 with switch off extended channel mode for this receiver.
     * @method ColorDistanceSensor#setPFExtendedChannel
     * @param {number} channel Channel number, between 1-8
     * @returns {Promise} Resolved upon successful issuance of the command.
     */
    public setPFExtendedChannel (channel: number) {
        let address = 0;
        if (channel >= 4) {
            channel -= 4;
            address = 1;
        }
        const message = Buffer.alloc(2);
        // Send "Extended toggle address command"
        message[0] = ((channel - 1) << 4) + (address << 3);
        message[1] = 6;
        return this.sendPFIRMessage(message);
    }


    /**
     * Set the power of a Power Functions motor via IR
     * @method ColorDistanceSensor#setPFPower
     * @param {number} channel Channel number, between 1-4
     * @param {string} output Outport port, "RED" (A) or "BLUE" (B)
     * @param {number} power -7 (full reverse) to 7 (full forward). 0 is stop. 8 is brake.
     * @returns {Promise} Resolved upon successful issuance of the command.
     */
    public setPFPower (channel: number, output: "RED" | "BLUE", power: number) {
        let address = 0;
        if (channel > 4) {
            channel -= 4;
            address = 1;
        }
        const message = Buffer.alloc(2);
        // Send "Single output mode"
        message[0] = ((channel - 1) << 4) + (address << 3) + (output === "RED" ? 4 : 5);
        message[1] = this._pfPowerToPWM(power) << 4;
        return this.sendPFIRMessage(message);
    }


    /**
     * Start Power Functions motors running via IR
     *
     * NOTE: This command is designed for bang-bang style operation. To keep the motors running, the sensor needs to be within range of the IR receiver constantly.
     * @method ColorDistanceSensor#startPFMotors
     * @param {Buffer} channel Channel number, between 1-4
     * @param {Buffer} powerA -7 (full reverse) to 7 (full forward). 0 is stop. 8 is brake.
     * @param {Buffer} powerB -7 (full reverse) to 7 (full forward). 0 is stop. 8 is brake.
     * @returns {Promise} Resolved upon successful issuance of the command.
     */
    public startPFMotors (channel: number, powerA: number, powerB: number) {
        let address = 0;
        if (channel > 4) {
            channel -= 4;
            address = 1;
        }
        const message = Buffer.alloc(2);
        // Send "Combo PWM mode"
        message[0] = (((channel - 1) + 4 + (address << 3)) << 4) + this._pfPowerToPWM(powerA);
        message[1] = this._pfPowerToPWM(powerB) << 4;
        return this.sendPFIRMessage(message);
    }


    /**
     * Send a raw Power Functions IR command
     * @method ColorDistanceSensor#sendPFIRMessage
     * @param {Buffer} message 2 byte payload making up a Power Functions protocol command. NOTE: Only specify nibbles 1-3, nibble 4 should be zeroed.
     * @returns {Promise} Resolved upon successful issuance of the command.
     */
    public sendPFIRMessage (message: Buffer) {
        if (this.isWeDo2SmartHub) {
            throw new Error("Power Functions IR is not available on the WeDo 2.0 Smart Hub");
        } else {
            const payload = Buffer.alloc(2);
            payload[0] = (message[0] << 4) + (message[1] >> 4);
            payload[1] = message[0] >> 4;
            this.subscribe(Mode.PF_IR);
            return this.writeDirect(0x07, payload);
        }
    }


    /**
     * Set the color of the LED on the sensor via a color value.
     * @method ColorDistanceSensor#setColor
     * @param {Color} color
     * @returns {Promise} Resolved upon successful issuance of the command.
     */
    public setColor (color: number | boolean) {
        return new Promise((resolve, reject) => {
            if (typeof color === "boolean") {
                color = 0;
            }
            if (this.isWeDo2SmartHub) {
                throw new Error("Setting LED color is not available on the WeDo 2.0 Smart Hub");
            } else {
                this.subscribe(Mode.LED);
                this.writeDirect(0x05, Buffer.from([color]));
            }
            return resolve();
        });
    }


    private _pfPowerToPWM (power: number) {
        return power & 15;
    }


}

export enum Mode {
    COLOR = 0x00,
    DISTANCE = 0x01,
    LED = 0x05,
    PF_IR = 0x07,
    COLOR_AND_DISTANCE = 0x08
}

export const ModeMap: {[event: string]: number} = {
    "color": Mode.COLOR,
    "distance": Mode.DISTANCE,
    "colorAndDistance": Mode.COLOR_AND_DISTANCE
};
