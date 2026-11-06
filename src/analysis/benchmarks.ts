// Benchmark references. A value is shown in the UI only when `verified` is true
// (checked against the original paper). Unverified entries show the citation
// with "no verifiable reference yet".

export interface Benchmark {
  id: string;
  citation: string;
  population: string;
  system: string;
  metric: string;
  value: string;
  verified: boolean;
  url?: string;
}

export const BENCHMARKS: Benchmark[] = [
  {
    id: 'ribeiro2020-distance',
    citation: 'Ribeiro et al. 2020, Activity Profile and Physical Performance of Match Play in Elite Futsal Players, Frontiers in Psychology 11',
    population: 'لاعيبة فوتسال نخبة',
    system: 'Local positioning system',
    metric: 'المسافة الكلية في الماتش',
    value: '≈ 3,749 ± 1,123 م',
    verified: false,
  },
  {
    id: 'ribeiro2020-hsr',
    citation: 'Ribeiro et al. 2020 (نفس الورقة)',
    population: 'لاعيبة فوتسال نخبة',
    system: 'Local positioning system',
    metric: 'المسافة فوق 18 كم/س',
    value: '≈ 135 ± 54 م',
    verified: false,
  },
  {
    id: 'ribeiro2020-acc',
    citation: 'Ribeiro et al. 2020 (نفس الورقة)',
    population: 'لاعيبة فوتسال نخبة',
    system: 'Local positioning system',
    metric: 'تسارعات / تباطؤات عالية الشدة',
    value: '≈ 87 ± 49 / 80 ± 32',
    verified: false,
  },
  {
    id: 'bueno2014',
    citation: 'De Oliveira Bueno et al. 2014 (مذكورة في Frontiers in Physiology 2016)',
    population: 'فوتسال محترفين برازيل',
    system: 'تتبع بالفيديو',
    metric: 'متر في الدقيقة (شوط أول / تاني)',
    value: '≈ 97.9 / 90.3 م/د',
    verified: false,
  },
  {
    id: 'barbero2008',
    citation: 'Barbero-Álvarez et al. 2008, Match analysis and heart rate of futsal players during competition, Journal of Sports Sciences 26:63-73',
    population: 'فوتسال محترفين',
    system: 'فيديو + حزام نبض',
    metric: 'النبض أثناء الماتش',
    value: '',
    verified: false,
  },
  {
    id: 'beato2017',
    citation: 'Beato et al. 2017 (مذكورة في أبحاث فوتسال السيدات)',
    population: 'فوتسال سيدات',
    system: 'GPS / LPS',
    metric: 'المسافة الكلية والنبض',
    value: '≈ 2,700 م، النبض غالباً فوق 85% من الأقصى',
    verified: false,
  },
];
