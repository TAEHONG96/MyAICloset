import {
  OutfitRecommendation,
  PurchaseCandidate,
  StylePreferences,
  WardrobeItem,
} from '../types/wardrobe';

export const INITIAL_WARDROBE_ITEMS: WardrobeItem[] = [
  {
    id: 'item-01',
    name: '차콜 울 싱글 블레이저',
    category: '아우터',
    color: '차콜',
    style: '미니멀',
    fit: '세미오버핏',
    season: '가을',
    notes: '어깨 패드가 과하지 않아 캐주얼·출근 모두 활용 가능',
    imageUrl: '/src/assets/images/charcoal_wool_blazer_1795066633210.jpg',
    visualMeta: {
      material: '울',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '노치드 라펠 · 투버튼',
    },
  },
  {
    id: 'item-02',
    name: '베이지 개버딘 트렌치코트',
    category: '아우터',
    color: '베이지',
    style: '클래식',
    fit: '루즈핏',
    season: '간절기',
    notes: '허리 벨트 탈부착 가능',
    imageUrl: '/src/assets/images/beige_trench_coat_1795066634059.jpg',
    visualMeta: {
      material: '코튼 개버딘',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '더블 브레스티드 · 웨이스트 벨트',
    },
  },
  {
    id: 'item-03',
    name: '블랙 울 맥시 핸드메이드 코트',
    category: '아우터',
    color: '블랙',
    style: '미니멀',
    fit: '오버핏',
    season: '겨울',
    notes: '두꺼운 니트 위에도 레이어드 가능',
    imageUrl: '/src/assets/images/black_wool_coat_1795066638536.jpg',
    visualMeta: {
      material: '울',
      pattern: '무지',
      thickness: '두꺼움',
      silhouetteDetail: '맥시 기장 · 드롭 숄더',
    },
  },
  {
    id: 'item-04',
    name: '화이트 코튼 옥스포드 셔츠',
    category: '상의',
    color: '화이트',
    style: '클래식',
    fit: '레귤러핏',
    season: '사계절',
    notes: '단독 착용 및 이너 레이어드 겸용',
    imageUrl: '/src/assets/images/white_oxford_shirt_1795066638168.jpg',
    visualMeta: {
      material: '코튼',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '버튼다운 칼라',
    },
  },
  {
    id: 'item-05',
    name: '아이보리 메리노울 크루넥 니트',
    category: '상의',
    color: '아이보리',
    style: '미니멀',
    fit: '레귤러핏',
    season: '가을',
    notes: '얇은 편직으로 자켓 이너에 적합',
    imageUrl: '/src/assets/images/ivory_knit_sweater_1795066638457.jpg',
    visualMeta: {
      material: '울',
      pattern: '무지',
      thickness: '얇음',
      silhouetteDetail: '크루넥 · 파인 게이지',
    },
  },
  {
    id: 'item-06',
    name: '네이비 스트라이프 코튼 긴팔 티셔츠',
    category: '상의',
    color: '네이비',
    style: '캐주얼',
    fit: '세미오버핏',
    season: '간절기',
    notes: '적당한 두께의 헤비 코튼',
    imageUrl: '/src/assets/images/navy_stripe_tee_1795066638794.jpg',
    visualMeta: {
      material: '코튼',
      pattern: '스트라이프',
      thickness: '보통',
      silhouetteDetail: '보트넥 라인',
    },
  },
  {
    id: 'item-07',
    name: '스카이블루 포플린 셔츠',
    category: '상의',
    color: '스카이블루',
    style: '비즈니스 캐주얼',
    fit: '세미오버핏',
    season: '봄',
    notes: '구김이 덜한 혼방 소재',
    imageUrl: '/src/assets/images/skyblue_poplin_shirt_1795066638682.jpg',
    visualMeta: {
      material: '코튼 혼방',
      pattern: '무지',
      thickness: '얇음',
      silhouetteDetail: '레귤러 칼라',
    },
  },
  {
    id: 'item-08',
    name: '오트밀 캐시미어 블렌드 가디건',
    category: '상의',
    color: '오트밀',
    style: '클래식',
    fit: '레귤러핏',
    season: '가을',
    notes: '단추를 잠가 풀오버처럼 착용 가능',
    imageUrl: '/src/assets/images/oatmeal_cashmere_cardigan_1795066638496.jpg',
    visualMeta: {
      material: '캐시미어 혼방',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '브이넥 · 프론트 버튼',
    },
  },
  {
    id: 'item-09',
    name: '블랙 원턱 와이드 슬랙스',
    category: '하의',
    color: '블랙',
    style: '미니멀',
    fit: '와이드핏',
    season: '사계절',
    notes: '구김 적은 TR 소재, 출근용 주력 하의',
    imageUrl: '/src/assets/images/black_wide_slacks_1795066638440.jpg',
    visualMeta: {
      material: '폴리·레이온(TR)',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '원턱 · 풀렝스',
    },
  },
  {
    id: 'item-10',
    name: '중청 스트레이트 셀비지 데님',
    category: '하의',
    color: '중청',
    style: '캐주얼',
    fit: '스트레이트핏',
    season: '사계절',
    notes: '자연스러운 워싱, 롤업 가능',
    imageUrl: '/src/assets/images/indigo_selvedge_denim_1795066638518.jpg',
    visualMeta: {
      material: '데님',
      pattern: '워싱 솔리드',
      thickness: '보통',
      silhouetteDetail: '스트레이트 레그 · 셀비지 밑단',
    },
  },
  {
    id: 'item-11',
    name: '올리브 코튼 치노 팬츠',
    category: '하의',
    color: '올리브',
    style: '시티보이',
    fit: '와이드핏',
    season: '가을',
    notes: '탄탄한 트윌 코튼 원단',
    imageUrl: '/src/assets/images/olive_chino_pants_1795066638455.jpg',
    visualMeta: {
      material: '코튼',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '트윌 조직 · 투턱 볼륨',
    },
  },
  {
    id: 'item-12',
    name: '블랙 페니 레더 로퍼',
    category: '신발',
    color: '블랙',
    style: '클래식',
    fit: '레귤러핏',
    season: '사계절',
    notes: '포멀·세미캐주얼 모두 무난하게 매치',
    imageUrl: '/src/assets/images/black_leather_loafer_1795066638036.jpg',
    visualMeta: {
      material: '가죽',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '라운드 토 · 페니 스트랩',
    },
  },
  {
    id: 'item-13',
    name: '화이트 레더 미니멀 스니커즈',
    category: '신발',
    color: '화이트',
    style: '미니멀',
    fit: '레귤러핏',
    season: '사계절',
    notes: '낮은 굽, 장시간 보행에 편안함',
    imageUrl: '/src/assets/images/white_leather_sneaker_1795066638496.jpg',
    visualMeta: {
      material: '가죽',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '로우탑 · 플랫 아웃솔',
    },
  },
  {
    id: 'item-14',
    name: '다크브라운 레더 숄더백',
    category: '가방/액세서리',
    color: '브라운',
    style: '클래식',
    fit: '레귤러핏',
    season: '사계절',
    notes: '13인치 노트북 수납 가능',
    imageUrl: '/src/assets/images/brown_shoulder_bag_1795066638447.jpg',
    visualMeta: {
      material: '가죽',
      pattern: '무지',
      thickness: '보통',
      silhouetteDetail: '구조적 토트·숄더 겸용',
    },
  },
];

export const INITIAL_STYLE_PREFERENCES: StylePreferences = {
  occasion: '출근/비즈니스',
  season: '가을',
  preferredStyle: '미니멀',
  additionalNotes: '가지고 있는 기본 아이템을 최대한 활용해 단정하면서도 활동하기 편한 조합을 원합니다.',
};

export const INITIAL_PURCHASE_CANDIDATE: PurchaseCandidate = {
  name: '네이비 울 더블 브레스티드 자켓',
  category: '아우터',
  color: '네이비',
  style: '클래식',
  fit: '세미오버핏',
  season: '가을',
  priceKrw: '248000',
  notes: '출근과 주말 모임에 두루 입으려고 고민 중입니다.',
  visualMeta: {
    material: '울',
    pattern: '무지',
    thickness: '보통',
    silhouetteDetail: '피크드 라펠 · 더블 브레스티드',
  },
};

export const PURCHASE_PRESETS: Array<{ label: string; candidate: PurchaseCandidate }> = [
  {
    label: '중복 검토 예시: 다크그레이 블레이저',
    candidate: {
      name: '다크그레이 투버튼 블레이저',
      category: '아우터',
      color: '차콜',
      style: '미니멀',
      fit: '세미오버핏',
      season: '가을',
      priceKrw: '198000',
      notes: '할인 중이라 눈에 들어온 기본 자켓',
      visualMeta: {
        material: '울',
        pattern: '무지',
        thickness: '보통',
        silhouetteDetail: '노치드 라펠 · 투버튼',
      },
    },
  },
  {
    label: '보완 검토 예시: 버건디 레더 벨트',
    candidate: {
      name: '버건디 송아지가죽 슬림 벨트',
      category: '가방/액세서리',
      color: '버건디',
      style: '클래식',
      fit: '레귤러핏',
      season: '사계절',
      priceKrw: '68000',
      notes: '무채색 코디에 은은한 포인트를 주고 싶음',
      visualMeta: {
        material: '가죽',
        pattern: '무지',
        thickness: '보통',
        silhouetteDetail: '실버 버클 · 2.5cm 슬림 폭',
      },
    },
  },
  {
    label: '계절 보완 예시: 린넨 반팔 셔츠',
    candidate: {
      name: '크림 린넨 오픈카라 반팔 셔츠',
      category: '상의',
      color: '아이보리',
      style: '캐주얼',
      fit: '루즈핏',
      season: '여름',
      priceKrw: '79000',
      notes: '여름철 출근 및 휴가 겸용',
      visualMeta: {
        material: '린넨',
        pattern: '무지',
        thickness: '얇음',
        silhouetteDetail: '오픈 카라 · 반팔',
      },
    },
  },
];

export const SAMPLE_CSV_TEXT = `이름,카테고리,색상,스타일,핏,계절,소재,패턴,두께,상세특징,메모
카멜 캐시미어 터틀넥 니트,상의,카멜,클래식,레귤러핏,겨울,캐시미어,무지,두꺼움,터틀넥 · 리브 밑단,코트 이너로 활용
연청 와이드 데님 팬츠,하의,연청,캐주얼,와이드핏,봄,데님,워싱 솔리드,보통,와이드 레그,밝은 톤 데일리 팬츠
스웨이드 첼시 부츠,신발,브라운,클래식,레귤러핏,가을,스웨이드,무지,보통,사이드 고어 · 아몬드 토,가을·겨울 포인트 슈즈`;

export const QUICK_CHAT_PROMPTS = [
  { label: '옷장 필수템 3가지', prompt: '내 옷장에서 가장 활용도가 높은 핵심 아이템 3가지는 무엇인가요?' },
  { label: '출근룩 바꿔 입기', prompt: '새 옷을 사지 않고 지금 옷들로 출근룩 분위기를 다르게 연출하는 팁을 알려주세요.' },
  { label: '옷장 중복·빈틈 점검', prompt: '현재 옷장에서 역할이 겹치는 옷과 부족한 계절·카테고리를 정리해 주세요.' },
  { label: '비 오는 가을날 코디', prompt: '비 오는 가을날 편하게 입을 수 있는 조합을 보유한 옷만으로 추천해 주세요.' },
] as const;

const STARTER_ITEM_MAP = new Map(INITIAL_WARDROBE_ITEMS.map((item) => [item.id, item]));

function pickStarterItems(ids: string[]): WardrobeItem[] {
  return ids
    .map((id) => STARTER_ITEM_MAP.get(id))
    .filter((item): item is WardrobeItem => Boolean(item));
}

export const INITIAL_SEED_OUTFITS: OutfitRecommendation[] = [
  {
    id: 'seed-outfit-1',
    title: '차콜·아이보리 톤온톤 미니멀 출근룩',
    itemIds: ['item-01', 'item-05', 'item-09', 'item-12', 'item-14'],
    items: pickStarterItems(['item-01', 'item-05', 'item-09', 'item-12', 'item-14']),
    conceptSummary: '차콜 블레이저와 아이보리 니트로 부드럽게 대비를 준 단정한 비즈니스 조합',
    stylingExplanation:
      '세미오버핏 차콜 울 싱글 블레이저 안에 레귤러핏 아이보리 메리노울 크루넥 니트를 받쳐 상체 실루엣을 정리하고, 블랙 원턱 와이드 슬랙스와 블랙 페니 로퍼로 하체 라인을 길어 보이게 연결했습니다. 다크브라운 레더 숄더백이 무채색 조합에 따뜻한 깊이를 더합니다.',
    tpoFit: '가을철 출근·미팅 환경에서 과하지 않으면서 신뢰감을 주는 단정한 구성입니다.',
    reuseTip:
      '니트 대신 보유 중인 화이트 코튼 옥스포드 셔츠로 이너만 교체해도 주중 2회 이상 다른 인상으로 활용할 수 있습니다.',
    assumptions:
      '슬랙스의 정확한 기장과 니트 네크라인 깊이는 입력 정보에 없어 표준 비율로 가정했습니다. 일교차가 큰 날에는 실내외 체온 차를 고려해 얇은 이너 레이어드가 필요할 수 있습니다.',
    rejectedIdsCount: 0,
    source: 'seed',
  },
  {
    id: 'seed-outfit-2',
    title: '베이지 트렌치·데님 클래식 스마트 캐주얼',
    itemIds: ['item-02', 'item-04', 'item-10', 'item-13', 'item-14'],
    items: pickStarterItems(['item-02', 'item-04', 'item-10', 'item-13', 'item-14']),
    conceptSummary: '간절기 베이지 트렌치코트에 옥스포드 셔츠와 중청 데님을 매치한 활동성 중심 룩',
    stylingExplanation:
      '루즈핏 베이지 개버딘 트렌치코트의 여유로운 드레이프 안에 화이트 코튼 옥스포드 셔츠와 스트레이트핏 중청 셀비지 데님을 매치해 깔끔한 균형을 잡았습니다. 화이트 레더 미니멀 스니커즈로 장시간 이동에도 부담 없는 경쾌한 마무리를 만들었습니다.',
    tpoFit: '외근이 많은 출근일이나 금요일 캐주얼 데이, 퇴근 후 모임까지 자연스럽게 이어집니다.',
    reuseTip:
      '트렌치코트의 허리 벨트를 뒤로 묶어 오픈하거나 단추를 채워 실루엣을 조이는 것만으로 새 옷 없이 두 가지 무드를 연출할 수 있습니다.',
    assumptions:
      '직장 내 데님·스니커즈 허용 복장 규정이 자율 복장 기준이라고 가정했습니다. 보수적인 복장 규정이라면 데님 대신 블랙 원턱 와이드 슬랙스로 대체하는 편이 안전합니다.',
    rejectedIdsCount: 0,
    source: 'seed',
  },
  {
    id: 'seed-outfit-3',
    title: '오트밀 가디건·올리브 치노 소프트 레이어드',
    itemIds: ['item-08', 'item-04', 'item-11', 'item-12', 'item-14'],
    items: pickStarterItems(['item-08', 'item-04', 'item-11', 'item-12', 'item-14']),
    conceptSummary: '아우터 없이 가디건과 셔츠를 레이어드한 따뜻한 어스 톤(Earth Tone) 조합',
    stylingExplanation:
      '오트밀 캐시미어 블렌드 가디건의 단추를 잠가 풀오버처럼 착용하고, 안쪽에 화이트 코튼 옥스포드 셔츠 칼라만 살짝 드러내 단정함을 살렸습니다. 와이드핏 올리브 코튼 치노 팬츠와 블랙 로퍼, 다크브라운 숄더백이 차분한 가을 색감을 완성합니다.',
    tpoFit: '초가을이나 실내 난방이 충분한 오피스, 주말 카페·전시 일정에 알맞습니다.',
    reuseTip:
      '기온이 떨어지면 이 조합 위에 보유 중인 베이지 개버딘 트렌치코트나 차콜 울 싱글 블레이저를 그대로 걸쳐 아우터 코디로 확장할 수 있습니다.',
    assumptions:
      '가디건의 실제 두께와 보온성이 기록되어 있지 않아 낮 기온 기준(15~20℃ 내외)으로 가정했습니다.',
    rejectedIdsCount: 0,
    source: 'seed',
  },
];

