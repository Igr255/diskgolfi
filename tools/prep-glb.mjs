// Usage (in a folder with @gltf-transform/core, /extensions, /functions and meshoptimizer installed):
//   node prep-glb.mjs in.glb out.glb
// Same squeeze as squeeze-glb.mjs, but first drops props characters ship holding
// (Quaternius "Weapon_*" nodes, swords, pistols, tridents) — used for the poly.pizza characters.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, resample, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [src, dst] = process.argv.slice(2);
const doc = await io.read(src);
const PROP = /^(weapon_.*|sword|pistol|trident)$/i;
const dropped = [];
for (const n of doc.getRoot().listNodes()) if (n.getMesh() && PROP.test(n.getName())) { dropped.push(n.getName()); n.dispose(); }
await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), resample({ tolerance: 1e-5 }), reorder({ encoder: MeshoptEncoder, target: 'size' }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(dst, doc);
console.log(dst.split('/').pop(), 'dropped:', dropped.join(',') || '-');
