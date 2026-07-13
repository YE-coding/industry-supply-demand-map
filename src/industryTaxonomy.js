export const primaryIndustryNames = ['半导体', '数据中心', '电力电网', '光通信', '新能源', '化工', '钢铁', '机器人'];

export const secondaryIndustryNames = ['AI算力', '液冷', '储能', '锂电池', '光伏', '铜', '铁矿石', '焦煤', '半导体设备', '先进封装'];

const primaryIndustries = new Set(primaryIndustryNames);
const secondaryIndustries = new Set(secondaryIndustryNames);

export function officialIndustryLayer(name) {
  if (primaryIndustries.has(name)) return '一级产业';
  if (secondaryIndustries.has(name)) return '二级环节';
  return '待归类案例';
}

export const relationSeeds = [
  { source: '半导体', target: '半导体设备', label: '扩产工具' },
  { source: '半导体', target: '先进封装', label: '集成瓶颈' },
  { source: '半导体', target: 'AI算力', label: '核心算力供给' },
  { source: 'AI算力', target: '数据中心', label: '算力承载' },
  { source: '光通信', target: 'AI算力', label: '集群互连' },
  { source: '光通信', target: '数据中心', label: '网络基础设施' },
  { source: '数据中心', target: '液冷', label: '高密度散热' },
  { source: '数据中心', target: '电力电网', label: '电力接入约束' },
  { source: '数据中心', target: '储能', label: '备用与调峰' },
  { source: '数据中心', target: '铜', label: '配电与散热材料' },
  { source: '电力电网', target: '新能源', label: '并网与消纳' },
  { source: '电力电网', target: '储能', label: '灵活性资源' },
  { source: '电力电网', target: '铜', label: '导体需求' },
  { source: '新能源', target: '光伏', label: '发电环节' },
  { source: '新能源', target: '储能', label: '波动平抑' },
  { source: '新能源', target: '锂电池', label: '储能载体' },
  { source: '新能源', target: '铜', label: '电气化用铜' },
  { source: '新能源', target: '化工', label: '材料与辅材' },
  { source: '锂电池', target: '储能', label: '系统核心部件' },
  { source: '化工', target: '锂电池', label: '电解液与材料' },
  { source: '化工', target: '光伏', label: '硅料与胶膜辅材' },
  { source: '焦煤', target: '钢铁', label: '炼焦成本输入' },
  { source: '铁矿石', target: '钢铁', label: '主原料输入' },
  { source: '钢铁', target: '机器人', label: '结构件与制造需求' },
  { source: '机器人', target: '半导体', label: '控制与感知芯片' },
  { source: '机器人', target: 'AI算力', label: '模型训练与推理' },
  { source: '机器人', target: '铜', label: '电机与线束材料' },
];
