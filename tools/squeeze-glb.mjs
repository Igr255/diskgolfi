// Usage (in a folder with @gltf-transform/core, /extensions, /functions and meshoptimizer installed):
//   node squeeze-glb.mjs in.glb out.glb
// Every GLB in models/ was processed with this. Originals live in git history (commit d98dec8).

// Lossless-ish GLB squeeze: prune/dedup/resample + meshopt stream compression WITHOUT quantization
// (attributes stay Float32 so r128 code that reads raw buffers keeps working).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, dedup, resample, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [src, dst] = process.argv.slice(2);
const doc = await io.read(src);
await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), resample({ tolerance: 1e-5 }), reorder({ encoder: MeshoptEncoder, target: 'size' }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(dst, doc);
