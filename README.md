# Head Start - 횡단보도/차량 신호 잔여시간 확인

서울 T-Data V2X SPaT 데이터를 활용한 신호 잔여시간 확인 서비스

## 데모 스크린샷

![Head Start 데모](docs/images/demo-home.png)

## 기능

- 실시간 신호 잔여시간 조회 + 상태 시각화
- 주소/현재 위치 기반 가까운 교차로 검색
- 즐겨찾기(로컬 저장)
- 자동 갱신 기능

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
npm run build:data-index
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 T-Data API 키를 설정합니다:

```env
TDATA_API_KEY=your-api-key-here
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어 확인합니다.

## 테스트

```bash
npm test
```

## 프로덕션 빌드

```bash
npm run build
npm start
```

## 배포 (간단)

- Vercel에 프로젝트를 연결한 뒤 배포합니다.
- 필수 환경 변수: `TDATA_API_KEY`
- CLI 배포가 필요하면 아래 명령으로 실행할 수 있습니다.

```bash
vercel
```

## API 엔드포인트

### `/api/spat`

교차로 신호 정보 조회

**요청 파라미터**
- `itstId`: 교차로 ID (필수)
- `timeoutMs`: 요청 타임아웃 (기본값: 25000)

**요청 예시**
```
GET /api/spat?itstId=1000&timeoutMs=25000
```

### `/api/nearby`

가까운 교차로 검색

**요청 파라미터**
- `lat`: 위도 (필수)
- `lon`: 경도 (필수)
- `k`: 결과 개수 (기본값: 5, 최대: 20)

**요청 예시**
```
GET /api/nearby?lat=37.5751483&lon=126.9770766&k=5
```

### `/api/geocode`

주소 → 좌표 변환

**요청 파라미터**
- `q`: 주소 문자열 (필수)

**요청 예시**
```
GET /api/geocode?q=중앙로%2010
```

## 프로젝트 구조

```
spat-nextjs/
├── docs/
│   └── images/          # 데모 이미지
├── pages/
│   ├── api/
│   │   ├── spat.ts       # SPaT 데이터 API
│   │   └── nearby.ts     # 가까운 교차로 검색 API
│   ├── _app.tsx          # 앱 래퍼
│   └── index.tsx         # 메인 페이지
├── lib/
│   ├── types.ts          # 타입 정의
│   └── utils.ts          # 유틸리티 함수
├── components/
│   ├── sections/         # 화면 섹션 분리
│   └── ui/               # shadcn/ui 기반 컴포넌트
├── hooks/                # 데이터 패칭 훅
├── styles/
│   └── globals.css       # 글로벌 스타일
├── data/
│   └── data.json         # 교차로 메타데이터
├── next.config.js        # Next.js 설정
├── tsconfig.json         # TypeScript 설정
├── vercel.json           # Vercel 배포 설정
└── package.json          # 프로젝트 의존성

```

## 데이터 소스

- **T-Data V2X**: 서울시 교통 데이터
  - 잔여시간: `/tapi/v2xSignalPhaseTimingInformation/1.0`
  - 신호상태: `/tapi/v2xSignalPhaseInformation/1.0`
- **OpenStreetMap Nominatim**: 주소 → 좌표 변환

## 성능 최적화

- 원본 데이터는 `data/data.json`이며, 런타임에서는 `data/itst-meta.json` 경량 인덱스를 우선 로드합니다.
- 경량 인덱스에는 `itstId`, `itstNm`, `lat`, `lon`만 포함합니다.
- 경량 인덱스가 없으면 `data/data.json`으로 자동 폴백합니다.
- 빌드 시 `prebuild`에서 인덱스 생성(`npm run build:data-index`)이 자동 실행됩니다.
- 수동으로 인덱스를 다시 만들고 싶다면:

```bash
npm run build:data-index
```

## 주의사항

- 실시간 데이터라도 통신/장비 상태에 따라 지연 또는 미수신이 발생할 수 있습니다
- 잔여시간은 "현재 켜진 신호" 기준이며, "다음 보행 시작까지 대기시간"은 별도 계산이 필요합니다
- 교차로 목록(`data/data.json`)에 없는 교차로는 검색되지 않습니다
