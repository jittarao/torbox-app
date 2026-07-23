export const DEFAULT_RSS_FEED_FORM = {
  name: '',
  url: '',
  rss_type: 'torrent',
  torrent_seeding: 1,
  do_regex: '',
  dont_regex: '',
  scan_interval: 60,
  dont_older_than: 0,
  pass_check: false,
};

export function rssFeedFormFromFeed(feed) {
  if (!feed) return { ...DEFAULT_RSS_FEED_FORM };

  return {
    name: feed.name || '',
    url: feed.url || '',
    rss_type: feed.rss_type || 'torrent',
    torrent_seeding: feed.torrent_seeding || 1,
    do_regex: feed.do_regex || '',
    dont_regex: feed.dont_regex || '',
    scan_interval: feed.scan_interval || 60,
    dont_older_than: feed.dont_older_than || 0,
    pass_check: feed.pass_check || false,
  };
}
