export interface WechatAccount {
  id: string;
  name: string;
  type: "服务号" | "订阅号";
  audience: string;
  tonality: string;
  avgReaders: number;
  avatarGradient: [string, string];
  lastPostedAt?: string;
}
