import definition from './assessment-definition.json';
import {z} from 'zod';
export const dimensions=['oil','dehydration','sensitivity','sun'] as const;
export const assessmentInput=z.object({submissionId:z.uuid(),version:z.literal(definition.version),name:z.string().trim().min(1).max(100),phone:z.string().regex(/^$|^\+?[0-9]{10,15}$/),answers:z.record(z.string(),z.array(z.number().int().nonnegative())),consentVersion:z.literal('2026-09-09')}).strict();
export function scoreAnswers(answers:Record<string,number[]>){
 if(Object.keys(answers).length!==definition.questions.length)throw new Error('Complete all questions');
 const scores={oil:0,dehydration:0,sensitivity:0,sun:0};
 for(const q of definition.questions){const choices=answers[q.id];if(!choices||!choices.length||choices.length>(q.multi?q.max!:1)||new Set(choices).size!==choices.length)throw new Error('Invalid selection');
 if(q.id==='secondary'&&choices.includes(4)&&choices.length>1)throw new Error('None must be selected alone');
 for(const i of choices){if(!Number.isInteger(i)||i<0||i>=q.options.length)throw new Error('Invalid option');const weights=q.options[i].w;for(const key of dimensions)scores[key]+=(weights as Record<string,number>)[key]||0;}}
 const primary=[...dimensions].sort((a,b)=>scores[b]-scores[a])[0];return {scores,primary};
}
export {definition};
