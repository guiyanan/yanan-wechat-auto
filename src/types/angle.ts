export interface Angle {
  id: string;
  order: number;
  name: string;
  sceneDesc: string;
  exampleTitle: string;
  promptInstruction: string;
  scope: "platform" | "tenant" | "user";
}
