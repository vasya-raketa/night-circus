import StaticBar from './StaticBar.js';
import ShortBar from './ShortBar.js';
import SwingingBar from './SwingingBar.js';
import RailBar from './RailBar.js';
import ElevatorBar from './ElevatorBar.js';
import SpinningRing from './SpinningRing.js';
import FragileBar from './FragileBar.js';
import SlipperyBar from './SlipperyBar.js';
import GoldenBar from './GoldenBar.js';
import PartnerCatcher from './PartnerCatcher.js';
import Trampoline from './Trampoline.js';
import Cannon from './Cannon.js';
import Zipline from './Zipline.js';
import FerrisWheel from './FerrisWheel.js';
import Balloon from './Balloon.js';
import FireHoop from './FireHoop.js';
import Sandbag from './Sandbag.js';
import KnifeWheel from './KnifeWheel.js';
import JugglingPins from './JugglingPins.js';
import Cannonball from './Cannonball.js';
import FallingProp from './FallingProp.js';
import SpotlightGlare from './SpotlightGlare.js';
import Smoke from './Smoke.js';
import ConfettiBlast from './ConfettiBlast.js';
import Lightning from './Lightning.js';
import Star from './Star.js';
import GoldRing from './GoldRing.js';
import Wind from './Wind.js';
import Rain from './Rain.js';
import Darkness from './Darkness.js';
import LowGravity from './LowGravity.js';
import Mirror from './Mirror.js';

// All course objects in menu order (numbered like the design list; #33 Tent collapse was
// replaced by the pressure modes and lives in src/old/objects).
export const CATALOG = [
  StaticBar, ShortBar, SwingingBar, RailBar, ElevatorBar, SpinningRing, FragileBar, SlipperyBar, GoldenBar,
  PartnerCatcher, Trampoline, Cannon, Zipline, FerrisWheel, Balloon,
  FireHoop, Sandbag, KnifeWheel, JugglingPins, Cannonball, FallingProp, SpotlightGlare, Smoke, ConfettiBlast, Lightning,
  Star, GoldRing,
  Wind, Rain, Darkness, LowGravity, Mirror
];

export const GROUPS = [
  { id: 'grab', title: 'Grab points' },
  { id: 'hazard', title: 'Hazards' },
  { id: 'collect', title: 'Collectibles' },
  { id: 'area', title: 'Area effects' }
];

export const byId = Object.fromEntries(CATALOG.map((cls) => [cls.info.id, cls]));
