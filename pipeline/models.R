#!/usr/bin/env Rscript
# Design-based logistic regressions for the association outputs.
#
#   Rscript pipeline/models.R extract.csv jobs.json results.json
#
# extract.csv: the harmonized rows for ages 12-25 (written by python -m pipeline.associations).
# jobs.json:   a list of {id, cohort, years, weight, outcome, exposure, adjust}.
# results.json: one entry per job with the odds ratio of the exposure term, its 95% CI
#               (exp(b ± t50 · SE)), the number of rows used, convergence and any error.
#
# The design is the users' guide design on the full file: svydesign(id=~VEREP,
# strata=~VESTR_C, weights=~w, nest=TRUE); every job subsets it (domain estimation, so
# all PSUs stay in the variance), then fits svyglm(..., family=quasibinomial()).
suppressPackageStartupMessages({
  library(survey)
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3) stop("usage: Rscript pipeline/models.R extract.csv jobs.json results.json")
extract_path <- args[[1]]
jobs_path <- args[[2]]
results_path <- args[[3]]

COVARIATES <- c("age_band", "sex", "race_ethnicity_5", "poverty")
DF <- 50
T_CRIT <- qt(0.975, DF)

options(survey.lonely.psu = "fail")
t0 <- Sys.time()
data <- read.csv(extract_path, stringsAsFactors = FALSE, na.strings = c("", "NA"))
for (v in c("cohort", COVARIATES)) data[[v]] <- factor(data[[v]])
jobs <- fromJSON(jobs_path, simplifyVector = FALSE)
cat(sprintf("models.R: %d rows, %d jobs\n", nrow(data), length(jobs)))

designs <- list()
design_for <- function(weight) {
  if (is.null(designs[[weight]])) {
    designs[[weight]] <<- svydesign(id = ~VEREP, strata = ~VESTR_C, weights = as.formula(paste0("~", weight)),
                                    data = data, nest = TRUE)
  }
  designs[[weight]]
}
for (w in unique(vapply(jobs, function(j) j$weight, ""))) design_for(w)

fit_job <- function(job) {
  result <- list(id = job$id, or = NULL, lo = NULL, hi = NULL, se_log = NULL, n = 0L, converged = FALSE, error = NULL)
  tryCatch({
    des <- design_for(job$weight)
    v <- des$variables
    keep <- v$cohort == job$cohort & v$YEAR %in% unlist(job$years) &
      !is.na(v[[job$outcome]]) & !is.na(v[[job$exposure]])
    if (isTRUE(job$adjust)) keep <- keep & complete.cases(v[, COVARIATES])
    keep[is.na(keep)] <- FALSE
    result$n <- sum(keep)
    dom <- subset(des, keep)
    terms <- if (isTRUE(job$adjust)) c(job$exposure, COVARIATES) else job$exposure
    formula <- reformulate(terms, response = job$outcome)
    warnings <- character(0)
    model <- withCallingHandlers(
      svyglm(formula, design = dom, family = quasibinomial(), control = glm.control(maxit = 100)),
      warning = function(w) { warnings <<- c(warnings, conditionMessage(w)); invokeRestart("muffleWarning") }
    )
    b <- coef(model)[[job$exposure]]
    s <- SE(model)[[job$exposure]]
    result$converged <- isTRUE(model$converged)
    if (!result$converged) {
      result$error <- "model did not converge"
    } else if (!is.finite(b) || !is.finite(s) || s <= 0) {
      result$error <- "exposure coefficient is not estimable"
    } else {
      result$or <- exp(b)
      result$lo <- exp(b - T_CRIT * s)
      result$hi <- exp(b + T_CRIT * s)
      result$se_log <- s
      if (length(warnings)) result$warnings <- unique(warnings)
    }
    result
  }, error = function(e) { result$error <- conditionMessage(e); result })
}

cores <- if (.Platform$OS.type == "windows") 1L else max(1L, parallel::detectCores() - 2L)
results <- if (cores > 1) parallel::mclapply(jobs, fit_job, mc.cores = cores) else lapply(jobs, fit_job)
failed <- vapply(results, function(r) inherits(r, "try-error"), logical(1))
if (any(failed)) stop("mclapply failed: ", results[[which(failed)[1]]])

write_json(results, results_path, auto_unbox = TRUE, null = "null", na = "null", digits = NA, pretty = FALSE)
n_ok <- sum(vapply(results, function(r) is.null(r$error), logical(1)))
cat(sprintf("models.R: %d of %d fits succeeded in %.0f s\n", n_ok, length(results), as.numeric(Sys.time() - t0, units = "secs")))
