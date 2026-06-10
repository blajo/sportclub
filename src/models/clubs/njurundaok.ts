import { IMobxClubModelProps } from '../../models/mobxClubModel';

const njurundaok: IMobxClubModelProps = {
  title: 'Njurunda OK',
  clubInfo: {
    name: 'Njurunda OK',
    organisationNumber: '889200-8171',
    address1: 'Guldvägen 31',
    zip: '862 40',
    city: 'Njurunda'
  },
  defaultLanguage: 'sv',
  map: {
    center: [17.39400, 62.26095],
    defaultZoomLevel: 10,
    saveUrl: 'https://njurundaok.se/map/tracks/save.php',
    queryUrl: 'https://njurundaok.se/map/tracks/jsonMapTracksQuery.php',
    layers: [
      {
        type: 'group',
        id: 'OrienteeringTileLayers',
        title: 'Njurunda OKs kartor 2026',
        layers: [
          {
            type: 'base-tile',
            id: 'OrienteeringTileLayer',
            title: 'Orienteringskarta',
            urlTemplate: 'https://njurundaok.se/maptiles/orienteering/{z}/{x}/{y}.png',
            minZoomLevel: 15,
            maxZoomLevel: 18,
            fullExtent: {
              xmin: 16.98,
              ymin: 62.1,
              xmax: 17.75,
              ymax: 62.35
            },
            zoomExtent: {
              xmin: 16.98,
              ymin: 62.1,
              xmax: 17.75,
              ymax: 62.35
            }
          }
        ]
      },
  ],
  },
  loginUrl: 'https://njurundaok.se/log_in.php',
  logoutUrl: 'https://njurundaok.se/log_out.php',
  attachmentUrl: 'https://njurundaok.se/showfile.php?iFileID=',
  invoice: {
    breakMonthDay: '1031',
    daysToDueDate: 30,
    account: '555-3862',
    accountType: 'Bankgiro',
    swishNumber: '123-419 95 50',
    message: 'Tävlingsavgift, {name}'
  },
  titleLogo: {
    url: 'https://njurundaok.se/images/NOKBanner.png',
    width: 1000,
    height: 100,
  },
  logo: {
    url: 'https://njurundaok.se/images/icons/nok80transp.png',
    width: 80,
    height: 80,
  },
  theme: {
    palette: {
      primary: {
        main: '#800020',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#ffffff',
        contrastText: '#000000',
      },
      error: {
        main: '#aa3333',
        contrastText: '#000000',
      },
      contrastThreshold: 3,
      tonalOffset: 0.2,
    },
    typography: {
      fontFamily:
        '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
      fontSize: 12,
    },
  },
  modules: [
    {
      name: 'News',
      addUrl: 'https://njurundaok.se/nyheterNew/save.php',
      deleteUrl: 'https://njurundaok.se/nyheterNew/delete.php',
      updateUrl: 'https://njurundaok.se/nyheterNew/save.php',
      queryUrl: 'https://njurundaok.se/nyheterNew/jsonNewsQuery.php',
    },
    {
      name: 'Calendar',
      queryUrl: 'https://njurundaok.se/kalenderNew/jsonCalendarQuery.php',
      addUrl: 'https://njurundaok.se/kalenderNew/saveCalendar.php',
      deleteUrl: 'https://njurundaok.se/kalenderNew/delete.php',
      updateUrl: 'https://njurundaok.se/kalenderNew/saveCalendar.php',
    },
    { name: 'ScoringBoard' },
    { name: 'Eventor' },
    {
      name: 'EventMap',
      queryUrl: 'https://njurundaok.se/eventmap/jsonEventMapQuery.php',
      addUrl: 'https://njurundaok.se/eventmap/save.php',
      updateUrl: 'https://njurundaok.se/eventmap/save.php',
      deleteUrl: 'https://njurundaok.se/eventmap/delete.php'
    },
    {
      name: 'Results',
      addUrl: 'https://njurundaok.se/resultNew/save.php',
      deleteUrl: 'https://njurundaok.se/resultNew/delete.php',
      updateUrl: 'https://njurundaok.se/resultNew/save.php',
      queryUrl: 'https://njurundaok.se/resultNew/jsonResultQuery.php',
    },
    {
      name: 'Users',
      addUrl: 'https://njurundaok.se/users/save.php',
      deleteUrl: 'https://njurundaok.se/users/delete.php',
      updateUrl: 'https://njurundaok.se/users/save.php',
      queryUrl: 'https://njurundaok.se/users/jsonUserQuery.php',
    },
    { name: 'Photo' },
    {
      name: 'HTMLEditor',
      addUrl: 'https://njurundaok.se/htmlEditorNew/save.php',
      deleteUrl: 'https://njurundaok.se/htmlEditorNew/delete.php',
      updateUrl: 'https://njurundaok.se/htmlEditorNew/save.php',
      queryUrl: 'https://njurundaok.se/htmlEditorNew/jsonHtmlEditorQuery.php',
    },
    {
      name: 'Files',
      addUrl: 'https://njurundaok.se/files/save.php',
      deleteUrl: 'https://njurundaok.se/files/delete.php',
      updateUrl: 'https://njurundaok.se/files/save.php',
      queryUrl: 'https://njurundaok.se/files/jsonFilesQuery.php'
    }
  ],
  links: [{ name: 'SOFT', url: 'https://www.svenskorientering.se' }],
  sports: ['Orientering'],
  eventor: {
    organisationId: 274,
    districtOrganisationId: 14,
    defaultOrganisationIdsNearbyAndClub: ['374', '568', '424', '215', '649', '618', '587'],
    defaultParentOrganisationIdsNational: [],
    defaultParentOrganisationIdsDistrict: ['11', '19', '5']
  },
  corsProxy: 'https://njurundaok.se/proxy.php?csurl=',
  eventorCorsProxy: 'https://njurundaok.se/eventorProxyWithCache.php',
  //oldUrl: 'https://njurundaok.org/',
  //facebookUrl: 'https://www.facebook.com/njurundaok',
  sponsors: [
    {
      name: 'SCA',
      logo: {
        url: 'https://njurundaok.se/images/sponsors/sca_logotyp_hemsida_150x50-px.png',
        width: 182,
        height: 94
      },
      url: 'https://www.sca.com/',
      active: true
    },
    {
      name: 'Sundsvalls kommun',
      logo: {
        url: 'https://njurundaok.se/images/sponsors/MedStödAvSundsvallsKommun.png',
        width: 303,
        height: 426
      },
      url: 'https://www.sundsvall.se/',
      active: true
    },
    {
      name: 'Gräsroten Svenska spel',
      logo: {
        url: 'https://njurundaok.se/images/sponsors/Grasroten_Foreningsmaterial_banner_195x150.gif',
        width: 195,
        height: 150
      },
      url: 'https://www.svenskaspel.se/grasroten',
      active: true
    },
    {
      name: 'Hälsinglands Sparbank',
      logo: {
        url: 'https://njurundaok.se/images/sponsors/8129-halsinglands-sparbank-logo-default.png',
        width: 174,
        height: 54
      },
      url: 'https://www.halsinglandssparbank.se',
      active: true
    }
  ],
};

export default njurundaok;
