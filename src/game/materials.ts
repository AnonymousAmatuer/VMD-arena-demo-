import type { MaterialClass } from "./data";

export interface MaterialGuide {
  category: string;
  summary: string;
  recommended: string[];
  weaknesses: string[];
  compatible: string[];
  destruction: string;
  howToUse: string;
  bestFor: "structure" | "armour" | "mobility" | "specialised";
  heat: string;
}
export const MATERIAL_GUIDE: Record<MaterialClass, MaterialGuide> = {
  wood: {
    category: "Natural timber",
    summary:
      "A light, forgiving structural timber that is cheap to replace and easy to shape. It absorbs blows instead of resisting them, which keeps a machine alive longer than its protection suggests.",
    recommended: ["Chassis bracing", "Outriggers", "Light superstructures"],
    weaknesses: [
      "Poor resistance to cutting tools",
      "Low compressive strength",
      "Splinters under repeated shock",
    ],
    compatible: ["Reinforced wood", "Iron", "Hardwood"],
    destruction:
      "Splits along the grain and breaks into fibrous chunks that scatters across the deck.",
    howToUse:
      "Use timber for lightweight frames, ramps and sacrificial bumpers rather than the part of the machine that takes the hit. Pair it with steel where bolts will be under load, and avoid it on the front of a fast vehicle, where a cutter will strip it away.",
    bestFor: "structure",
    heat: "Scorches and chars above 260°C; no protection from open flame.",
  },
  hardwood: {
    category: "Natural timber",
    summary:
      "Cross-braced hardwood with reinforced corners. It carries more load than plain timber and holds bolts far better, at a small increase in mass.",
    recommended: ["Chassis frames", "Armour backing", "Tool handles"],
    weaknesses: ["Still vulnerable to saws", "Heavier than plain timber"],
    compatible: ["Steel", "Iron", "Copper"],
    destruction:
      "Splinters in long shards and leaves the mount rattling loose.",
    howToUse:
      "Hardwood is the sensible early upgrade for a chassis that keeps taking impacts. It suits machines that need to look rugged and survive scrapes, but it should never be your outermost armour against a rotating blade.",
    bestFor: "structure",
    heat: "Chars slowly; adequate for engine heat, not for sustained fire.",
  },
  cardboard: {
    category: "Packaging composite",
    summary:
      "The cheapest material in the workshop and almost weightless. It deforms instead of breaking, which makes it a superb sacrificial skin and a poor firewall.",
    recommended: ["Fairings", "Fillers", "Temporary shielding"],
    weaknesses: [
      "Almost no structural strength",
      "Tears instantly",
      "Ignites easily",
    ],
    compatible: ["Wood", "Polymer", "Foam"],
    destruction:
      "Crushes flat, folds along its creases and scatters as paper scraps.",
    howToUse:
      "Cardboard exists to shape the machine, not to protect it. Use it to fill gaps, to cover cables, or as a decoy that soaks a hit meant for real armour. Never build a drivetrain or a lifting frame out of it.",
    bestFor: "specialised",
    heat: "Ignites within seconds of direct flame exposure.",
  },
  box: {
    category: "Packaging composite",
    summary:
      "A hollow shipping carton. Light, stackable and surprisingly good at absorbing a single impact before it gives up entirely.",
    recommended: ["Cargo pods", "Bumpers", "Nested superstructures"],
    weaknesses: ["Crushes under sustained load", "No resistance to cutting"],
    compatible: ["Cardboard", "Foam", "Rubber"],
    destruction: "Buckles, then collapses into flattened panels.",
    howToUse:
      "Boxes are ideal for bulky, non-structural additions where mass matters more than protection. Stack them around a payload, or line the front of a light machine so the first collision is absorbed by packaging rather than by engineering.",
    bestFor: "specialised",
    heat: "Burns readily and gives off heavy smoke.",
  },
  stone: {
    category: "Mineral",
    summary:
      "Enormous mass and superb compression strength. Stone resists crushing better than anything else in the catalogue, but it has almost no tensile strength and will crack apart when bent.",
    recommended: ["Ballast", "Rams", "Impact cores"],
    weaknesses: [
      "Very heavy",
      "Brittle under tension",
      "Poor performance for flight",
    ],
    compatible: ["Steel", "Reinforced steel", "Concrete-like structures"],
    destruction:
      "Cracks into heavy angular fragments that keep their momentum after impact.",
    howToUse:
      "Stone belongs on machines that want to hit things rather than survive them. Use it as a ram core or as ballast low in the chassis, and keep it away from the top of a tall build where the mass works against you.",
    bestFor: "specialised",
    heat: "Withstands heat excellently; stone rarely deforms.",
  },
  iron: {
    category: "Ferrous metal",
    summary:
      "Dense, dependable and cheap. Iron is heavier than steel but tougher against blunt impacts, and its mass makes a good weapon body.",
    recommended: ["Armour blocks", "Weight distribution", "Hammer heads"],
    weaknesses: [
      "Heavy",
      "Rusts without protection",
      "Poor resistance to cutting",
    ],
    compatible: ["Steel", "Copper", "Brass"],
    destruction: "Buckles and sheds orange-brown rust flakes as it deforms.",
    howToUse:
      "Iron is the workhorse of the early workshop. Use it for armour that must take a beating rather than a blade, and remember that every extra kilogram slows acceleration and raises fuel use on the way to the arena.",
    bestFor: "armour",
    heat: "Holds shape well but loses temper near 600°C.",
  },
  steel: {
    category: "Ferrous metal",
    summary:
      "The benchmark structural metal: high strength, high durability, moderate mass. Steel resists cutting well and bends before it breaks.",
    recommended: ["Chassis", "Structural beams", "Weapon frames"],
    weaknesses: ["Moderately heavy", "Can be cut by dedicated saws"],
    compatible: ["Iron", "Titanium", "Brass", "Composites"],
    destruction:
      "Bends into a curl, tears along the weld lines and rings when struck.",
    howToUse:
      "Steel is the default answer for a load-bearing part. Use it for the spine of a chassis and for anything that must hold a rotating assembly in place. Balance it with aluminium or carbon where mass is limiting.",
    bestFor: "structure",
    heat: "Loses strength above 500°C but stays dimensionally stable.",
  },
  "reinforced-steel": {
    category: "Ferrous metal",
    summary:
      "A heavier, layered steel that spreads loads across a wider area. Far tougher than plain steel, and correspondingly expensive and heavy.",
    recommended: ["Heavy armour", "Collision frames", "Battering fronts"],
    weaknesses: [
      "Very heavy",
      "Expensive salvage cost",
      "Overkill for light machines",
    ],
    compatible: ["Titanium", "Steel", "Copper"],
    destruction:
      "Deforms slowly and in layers, tearing apart in heavy folded plates.",
    howToUse:
      "Reinforced steel belongs on the part of a machine that absorbs the championship-level hits. Use it for the leading edge and the chassis core, and support it with aluminium where you need the mass down.",
    bestFor: "armour",
    heat: "Excellent heat resistance; the layers resist distortion.",
  },
  aluminium: {
    category: "Light alloy",
    summary:
      "A featherweight alloy with respectable strength. It is the material that makes flight and high-speed builds possible at all.",
    recommended: ["Rotor masts", "Frames", "Aerial hulls"],
    weaknesses: [
      "Dents easily",
      "Poor resistance to hard impacts",
      "Low hardness",
    ],
    compatible: ["Carbon fibre", "Steel", "Titanium"],
    destruction:
      "Dents and folds with a metallic shriek rather than shattering.",
    howToUse:
      "Reach for aluminium wherever a heavy part is costing you speed or lift. It is ideal for rotor supports and lightweight superstructures, but avoid it as the only barrier between a hammer and your chassis.",
    bestFor: "mobility",
    heat: "Softens around 470°C; keep it away from exhaust heat.",
  },
  titanium: {
    category: "Light alloy",
    summary:
      "An advanced alloy with outstanding strength-to-weight and excellent fatigue resistance. It resists heat and keeps its integrity when everything around it deforms.",
    recommended: ["Armour", "Landing gear", "High-stress mounts"],
    weaknesses: [
      "Costly",
      "Heavy compared with aluminium",
      "Requires rare research",
    ],
    compatible: ["Carbon fibre", "Reinforced steel", "Copper"],
    destruction:
      "Deforms slowly and resists tearing, then snaps clean when finally overcome.",
    howToUse:
      "Titanium is the answer when a part must be both strong and light, such as a rotor shaft or the frame beneath an expensive weapon. Pair it with carbon fibre to build a machine that is both fast and protected.",
    bestFor: "structure",
    heat: "Excellent heat resistance; remains rigid at high temperature.",
  },
  copper: {
    category: "Conductive metal",
    summary:
      "A dense, malleable conductor. It is the material of wiring and bus bars, and it lends a small amount of regeneration to any machine that uses it.",
    recommended: ["Power conduits", "Bus bars", "Generators"],
    weaknesses: ["Soft", "Corrodes quickly", "Poor armour value"],
    compatible: ["Brass", "Polymer", "Steel"],
    destruction: "Buckles and smears, leaving bright green corrosion.",
    howToUse:
      "Use copper in the electrical path rather than the armour path. Run power through copper blocks and bus bars, and keep them close to the batteries and controllers so the supply stays efficient.",
    bestFor: "specialised",
    heat: "Conducts heat extremely well; avoid placing it next to hot engines.",
  },
  brass: {
    category: "Precision alloy",
    summary:
      "A machined brass used for bearings, gears and joints. It is the classic mechanical material: tough, precise and resistant to corrosion.",
    recommended: ["Bearings", "Gearboxes", "Joints", "Bushings"],
    weaknesses: [
      "Moderately heavy for its job",
      "Softens under sustained friction",
    ],
    compatible: ["Steel", "Copper", "Titanium"],
    destruction:
      "Peels into bright curls as bearings wear and finally tear apart.",
    howToUse:
      "Brass is what you build rotating assemblies from. Use it for bearings, gearboxes and rotational joints where smooth, corrosion-free motion matters more than raw armour strength.",
    bestFor: "specialised",
    heat: "Holds its shape well below 300°C.",
  },
  carbon: {
    category: "Fibre composite",
    summary:
      "An ultra-light structural composite with excellent stiffness. It makes fast and aerial machines possible, though a hard enough impact can fracture the weave.",
    recommended: ["Aerial hulls", "Race frames", "Fairings", "Beams"],
    weaknesses: [
      "Fractures under hard impacts",
      "Poor heat tolerance",
      "Expensive",
    ],
    compatible: ["Aluminium", "Titanium", "Polymer"],
    destruction: "Splits along the weave and sheds sharp black splinters.",
    howToUse:
      "Carbon fibre belongs wherever mass is the enemy: airframes, suspension links, bodywork over a chassis. Back it with steel or ceramic in the zones that take the most abuse.",
    bestFor: "mobility",
    heat: "Resists heat poorly; the resin softens and the fibres loosen.",
  },
  ceramic: {
    category: "Technical ceramic",
    summary:
      "Extremely hard armour tile that shrugs off cutting tools and deflects impact. Its brittleness means it will shatter spectacularly rather than bend.",
    recommended: ["Deflective armour", "Cutting guards", "Skids"],
    weaknesses: [
      "Brittle",
      "Shatters under blunt impact",
      "Poor at absorbing energy",
    ],
    compatible: ["Composite armour", "Titanium", "Steel"],
    destruction:
      "Explodes into sharp ceramic shards that scythe across the deck.",
    howToUse:
      "Ceramic is a specialist answer to specific threats. Use it where saws and drills are the danger, layer it over a compliant core, and never rely on it alone against a falling mass.",
    bestFor: "armour",
    heat: "Excellent heat resistance; it will not melt.",
  },
  composite: {
    category: "Layered composite",
    summary:
      "Several bonded layers of different materials, spreading an impact across the whole panel. A balanced choice of protection and weight.",
    recommended: ["Hull plating", "Armour skirts", "Bumper stacks"],
    weaknesses: ["Costlier than steel", "Can delaminate at the edges"],
    compatible: ["Ceramic", "Carbon fibre", "Steel"],
    destruction:
      "Peels apart into its separate layers, each fragment keeping its own character.",
    howToUse:
      "Composite armour is the sensible default for a machine that must survive a championship fight without becoming a roadblock. Use it over a steel backbone so the layers have something to bond to.",
    bestFor: "armour",
    heat: "Handles moderate heat well; the binder limits at high temperature.",
  },
  rubber: {
    category: "Elastomer",
    summary:
      "A compliant, high-grip material that soaks up collisions and keeps its shape under load. It is the material of tyres, bumpers and pads.",
    recommended: ["Tyres", "Bumpers", "Vibration pads"],
    weaknesses: ["Very soft", "Poor cutting resistance", "Can be torn away"],
    compatible: ["Foam", "Polymer", "Steel"],
    destruction: "Tears into rubber strips and flattens where it was crushed.",
    howToUse:
      "Use rubber wherever energy needs to be absorbed instead of transferred. Fit it to bumpers, wheel hubs and suspension, and remember that a torn tyre loses almost all of its grip.",
    bestFor: "mobility",
    heat: "Softens noticeably above 90°C.",
  },
  "reinforced-rubber": {
    category: "Elastomer",
    summary:
      "Fabric-reinforced rubber that keeps the grip and damping of rubber while surviving far more abuse. The choice for heavy machines.",
    recommended: ["Heavy tyres", "Impact pads", "Winch lines"],
    weaknesses: [
      "Still vulnerable to saws",
      "Adds mass",
      "Difficult to recycle",
    ],
    compatible: ["Rubber", "Steel", "Composite armour"],
    destruction: "Frays into woven cords, then tears away in thick slabs.",
    howToUse:
      "Reinforced rubber belongs on machines that carry weight and take punishment. Use it for the wheels of a heavy build and for bumpers that must survive being hit by a ram.",
    bestFor: "mobility",
    heat: "Holds shape to about 130°C.",
  },
  foam: {
    category: "Energy absorber",
    summary:
      "A featherweight crush foam that compresses under load and releases the energy of an impact instead of passing it on.",
    recommended: ["Bumper cores", "Cargo protection", "Underbody padding"],
    weaknesses: [
      "Almost no strength",
      "Permanent deformation",
      "Fires readily",
    ],
    compatible: ["Cardboard", "Rubber", "Polymer"],
    destruction: "Collapses into a flat, spent mat and stays there.",
    howToUse:
      "Foam is a deliberate energy sink. Put it between a weapon and the chassis, or around a fragile payload, so a hit is absorbed rather than transmitted. It will never be a structural part.",
    bestFor: "specialised",
    heat: "Ignites easily and produces heavy smoke.",
  },
  polymer: {
    category: "Engineering polymer",
    summary:
      "A corrosion-proof engineering plastic with dependable strength and low mass. It shrugs off water and chemicals, making it ideal for exposed mechanisms.",
    recommended: ["Casings", "Electronics housings", "Bodywork"],
    weaknesses: [
      "Moderate hardness",
      "Creeps under sustained load",
      "Softens with heat",
    ],
    compatible: ["Copper", "Steel", "Carbon fibre"],
    destruction: "Cracks into sharp shards and deforms permanently under load.",
    howToUse:
      "Polymer is the material for housings and anything exposed to weather. Use it for battery cases, control panels and fairings, and keep structural frames in metal.",
    bestFor: "specialised",
    heat: "Softens around 110°C; keep it away from engines and exhausts.",
  },
  exotic: {
    category: "Experimental lattice alloy",
    summary:
      "A championship-grade lattice alloy that outperforms every common material in almost every measurement. It is also the most expensive thing in the workshop.",
    recommended: ["Chassis cores", "Rotor hubs", "Blade mounts"],
    weaknesses: [
      "Very costly",
      "Demands careful mounting",
      "Ruins a light budget",
    ],
    compatible: ["Titanium", "Carbon fibre", "Reinforced steel"],
    destruction:
      "Absorbs enormous punishment before finally shearing into clean, heavy fragments.",
    howToUse:
      "Treat experimental alloy as the finishing touch on a machine that already works. Use it on the chassis core and the mounts carrying your best weapons, and only once the design is settled.",
    bestFor: "structure",
    heat: "Outstanding heat resistance for a light material.",
  },
};
