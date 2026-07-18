use crate::constants::START_HIDDEN_LAUNCH_ARG;

pub fn launched_with_start_hidden_arg() -> bool {
    std::env::args().any(|arg| arg == START_HIDDEN_LAUNCH_ARG)
}

pub fn login_launch_should_hide(
    launch_at_login: bool,
    start_hidden: bool,
    has_start_hidden_arg: bool,
) -> bool {
    has_start_hidden_arg && launch_at_login && start_hidden
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hides_only_for_login_launch_with_arg_and_pref() {
        assert!(login_launch_should_hide(true, true, true));
        assert!(!login_launch_should_hide(true, true, false));
        assert!(!login_launch_should_hide(false, true, true));
        assert!(!login_launch_should_hide(true, false, true));
    }
}
