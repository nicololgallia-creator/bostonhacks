// Every song, sorted shortest first. Add a song: drop the file in songs/ and add one import line here
// (songs.test.js fails if a file is missing from this list).
import { songSeconds } from "../game/engine.js";
import twinkle from "../../songs/twinkle.json" with { type: "json" };
import maryLamb from "../../songs/mary-lamb.json" with { type: "json" };
import rowBoat from "../../songs/row-boat.json" with { type: "json" };
import happyBirthday from "../../songs/happy-birthday.json" with { type: "json" };
import londonBridge from "../../songs/london-bridge.json" with { type: "json" };
import frereJacques from "../../songs/frere-jacques.json" with { type: "json" };
import saints from "../../songs/saints.json" with { type: "json" };
import furElise from "../../songs/fur-elise.json" with { type: "json" };
import jingleBells from "../../songs/jingle-bells.json" with { type: "json" };
import odeToJoy from "../../songs/ode-to-joy.json" with { type: "json" };
import ship from "../../songs/ship-never-returned.json" with { type: "json" };
import greensleeves from "../../songs/greensleeves.json" with { type: "json" };
import sweetCaroline from "../../songs/sweet-caroline.json" with { type: "json" };
import shippingUpToBoston from "../../songs/shipping-up-to-boston.json" with { type: "json" };
import dirtyWater from "../../songs/dirty-water.json" with { type: "json" };
import moreThanAFeeling from "../../songs/more-than-a-feeling.json" with { type: "json" };
import sevenNationArmy from "../../songs/seven-nation-army.json" with { type: "json" };

export const songs = [twinkle, maryLamb, rowBoat, happyBirthday, londonBridge, frereJacques, saints, furElise, jingleBells, odeToJoy, ship, greensleeves, sweetCaroline, shippingUpToBoston, dirtyWater, moreThanAFeeling, sevenNationArmy]
  .sort((a, b) => songSeconds(a) - songSeconds(b));

export const songById = (id) => songs.find((s) => s.id === id);
