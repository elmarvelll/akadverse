import { PrismaClient, Prisma } from "@prisma/client";
import { elearningDb as academic } from "../../src/lib/db/elearning";
import { mkdirSync, writeFileSync } from "node:fs";
const core = new PrismaClient();
async function main(){
 const users=await core.user.findMany({select:{id:true,firstName:true,lastName:true,email:true,role:true,isAdmin:true}});
 const keep=users.filter(u=>u.firstName.trim().toLowerCase()==="marvelous" && u.lastName.trim().toLowerCase()==="ifezue");
 if(!keep.length)throw new Error("No exact owner match: explicit owner IDs required");
 const remove=users.filter(u=>!keep.some(k=>k.id===u.id));const dependencies=[];
 for(const model of Prisma.dmmf.datamodel.models)for(const relation of model.fields.filter(f=>f.kind==="object" && f.type==="User" && f.relationFromFields?.length===1)){
  const field=relation.relationFromFields![0];const delegate=model.name[0].toLowerCase()+model.name.slice(1);
  const count=await (core as unknown as Record<string,{count(args:unknown):Promise<number>}>)[delegate].count({where:{[field]:{in:remove.map(u=>u.id)}}});
  dependencies.push({model:model.name,field,onDelete:relation.relationOnDelete,count});
 }
 const structures=await academic.curriculum.findMany({where:{programme:{code:"EEE"},courses:{some:{level:400}}},include:{programme:{include:{department:true}},semester:true,courses:{include:{course:true,offering:{include:{lecturers:true,materials:true}}}}}});
 const report={createdAt:new Date().toISOString(),keep,remove,dependencies,eee400Structures:structures};
 mkdirSync(".elearning-reset",{recursive:true,mode:0o700});const file=`.elearning-reset/owner-reset-audit-${Date.now()}.json`;writeFileSync(file,JSON.stringify(report,null,2),{mode:0o600,flag:"wx"});
 console.log("Preserve accounts:",keep.map(u=>({email:u.email,role:u.role,id:u.id})));console.log("Other accounts:",remove.length);console.table(dependencies.filter(d=>d.count));console.log("EEE 400 structures:",structures.map(s=>({id:s.id,status:s.status,semester:s.semester.name,courses:s.courses.filter(c=>c.level===400).length})));console.log(file);
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Audit failed");process.exitCode=1}).finally(async()=>{await core.$disconnect();await academic.$disconnect()});
